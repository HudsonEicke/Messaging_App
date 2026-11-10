import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from './store';
import type { ConversationResponse, CreateConversationRequest, MessageResponse, SendMessageRequest, UpdateConversationRequest, UserResponse } from '@/types';
import type { ApiError } from '@/lib/utils';
import { getApiError } from '@/lib/utils';
import { editMessageText, insertMessage, removeMessage, updateSenderProfile } from '@/lib/messageList';
import { clearTokens } from './authSlice';
import { conversationCreated, conversationMemberAdded, conversationMemberRemoved, conversationMessageDeleted, conversationMessageEdited, conversationMessageReceived, conversationOwnerChanged, conversationReadStateUpdated, conversationRemoved, conversationUpdated, userStatusChanged, userUpdated } from './hubEvents';
import { getConversations, getConversation, createConversation as createConversationRequest, updateConversation as updateConversationRequest, leaveConversation as leaveConversationRequest, getMessages, sendMessage as sendMessageRequest, editMessage as editMessageRequest, deleteMessage as deleteMessageRequest, getConversationMembers, addMember as addMemberRequest, markConversationRead as markConversationReadRequest } from '@/services/conversationService';

const MESSAGE_PAGE_SIZE = 50;

type FetchStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface ConversationState
{
    conversations: ConversationResponse[];
    hasLoadedConversations: boolean;
    messagesByConversation: Record<number, MessageResponse[]>;
    hasMoreMessages: Record<number, boolean>;
    membersByConversation: Record<number, UserResponse[]>;
    conversationsStatus: FetchStatus;
    conversationsError: ApiError | null;
    messagesStatusByConversation: Record<number, FetchStatus>;
    messagesErrorByConversation: Record<number, ApiError | null>;
    error: ApiError | null;
}

const initialState: ConversationState = {
    conversations: [],
    hasLoadedConversations: false,
    messagesByConversation: {},
    hasMoreMessages: {},
    membersByConversation: {},
    conversationsStatus: 'idle',
    conversationsError: null,
    messagesStatusByConversation: {},
    messagesErrorByConversation: {},
    error: null
};

// shared by the thunks and the hub events; a conversation that hasn't been opened has no cache to change
const addMessage = (state: ConversationState, conversationID: number, message: MessageResponse) => {
    const messages = state.messagesByConversation[conversationID];

    if (messages)
    {
        insertMessage(messages, message);
    }
};

const applyMessageEdit = (state: ConversationState, conversationID: number, messageID: number, messageText: string) => {
    const messages = state.messagesByConversation[conversationID];

    if (messages)
    {
        editMessageText(messages, messageID, messageText);
    }
};

const applyMessageDelete = (state: ConversationState, conversationID: number, messageID: number) => {
    const messages = state.messagesByConversation[conversationID];

    if (messages)
    {
        removeMessage(messages, messageID);
    }
};

// the list is sorted by recent activity, and the backend marks your own messages read
const bumpConversation = (state: ConversationState, conversationID: number, messageID: number, isOwnMessage: boolean) => {
    const index = state.conversations.findIndex(conversation => conversation.id === conversationID);

    // your own message comes from both the response and the hub, so only count it once
    if (index === -1 || (state.conversations[index].lastMessageID ?? 0) >= messageID)
    {
        return;
    }

    const [conversation] = state.conversations.splice(index, 1);
    conversation.lastMessageID = messageID;
    conversation.unreadCount = isOwnMessage ? 0 : conversation.unreadCount + 1;
    state.conversations.unshift(conversation);
};

// matches the backend's order: most recent activity first, then conversations with no messages, newest first
const comesBefore = (conversation: ConversationResponse, other: ConversationResponse) =>
    (conversation.lastMessageID ?? 0) > (other.lastMessageID ?? 0)
    || ((conversation.lastMessageID ?? 0) === (other.lastMessageID ?? 0) && conversation.id > other.id);

// the hub also delivers conversations you created, so it may already be listed
const insertConversation = (state: ConversationState, conversation: ConversationResponse) => {
    if (state.conversations.some(listedConversation => listedConversation.id === conversation.id))
    {
        return;
    }

    const index = state.conversations.findIndex(listedConversation => comesBefore(conversation, listedConversation));

    state.conversations.splice(index === -1 ? state.conversations.length : index, 0, conversation);
};

const removeConversation = (state: ConversationState, conversationID: number) => {
    state.conversations = state.conversations.filter(conversation => conversation.id !== conversationID);
    delete state.messagesByConversation[conversationID];
    delete state.hasMoreMessages[conversationID];
    delete state.membersByConversation[conversationID];
    delete state.messagesStatusByConversation[conversationID];
    delete state.messagesErrorByConversation[conversationID];
};

// only add to a list that was already loaded, otherwise it would look like a one member group
const addListedMember = (state: ConversationState, conversationID: number, member: UserResponse) => {
    const members = state.membersByConversation[conversationID];

    if (members && !members.some(listedMember => listedMember.username === member.username))
    {
        members.push(member);
    }
};

const removeListedMember = (state: ConversationState, conversationID: number, username: string) => {
    const members = state.membersByConversation[conversationID];

    if (members)
    {
        state.membersByConversation[conversationID] = members.filter(member => member.username !== username);
    }
};

export const fetchConversations = createAsyncThunk<ConversationResponse[], void, { rejectValue: ApiError }>('conversation/fetchConversations', async (_, { rejectWithValue }) => {
    try
    {
        return await getConversations();
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not load conversations'));
    }
});

export const createConversation = createAsyncThunk<ConversationResponse, CreateConversationRequest, { rejectValue: ApiError }>('conversation/createConversation', async (request, { rejectWithValue }) => {
    try
    {
        const result = await createConversationRequest(request);

        return {
            id: result.conversationID,
            conversationName: result.conversationName,
            ownerUsername: result.ownerUsername,
            otherUsername: result.otherUsername,
            iconUrl: result.iconUrl,
            conversationType: result.conversationType,
            lastMessageID: null,
            unreadCount: 0
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not create conversation'));
    }
});

export const updateConversation = createAsyncThunk<ConversationResponse, { id: number; request: UpdateConversationRequest }, { rejectValue: ApiError }>('conversation/updateConversation', async ({ id, request }, { rejectWithValue }) => {
    try
    {
        await updateConversationRequest(id, request);

        // backend returns no body, so refetch to get the saved name and icon
        return await getConversation(id);
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not update conversation'));
    }
});

export const leaveConversation = createAsyncThunk<number, number, { rejectValue: ApiError }>('conversation/leaveConversation', async (id, { rejectWithValue }) => {
    try
    {
        await leaveConversationRequest(id);
        return id;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not leave conversation'));
    }
});

export const fetchMessages = createAsyncThunk<{ conversationID: number; before?: number; messages: MessageResponse[]; hasMore: boolean }, { conversationID: number; before?: number }, { state: RootState; rejectValue: ApiError }>('conversation/fetchMessages', async ({ conversationID, before }, { rejectWithValue }) => {
    try
    {
        const page = await getMessages(conversationID, before);

        // backend sends newest first, store oldest first so the list renders top to bottom
        return {
            conversationID,
            before,
            messages: page.reverse(),
            hasMore: page.length === MESSAGE_PAGE_SIZE
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not load messages'));
    }
}, {
    // scrolling can ask for the same older page more than once while it's loading
    condition: ({ conversationID }, { getState }) => getState().conversation.messagesStatusByConversation[conversationID] !== 'loading'
});

export const sendMessage = createAsyncThunk<{ conversationID: number; message: MessageResponse }, { conversationID: number; request: SendMessageRequest }, { rejectValue: ApiError }>('conversation/sendMessage', async ({ conversationID, request }, { rejectWithValue }) => {
    try
    {
        const result = await sendMessageRequest(conversationID, request);

        return {
            conversationID,
            message: { ...result, edited: false }
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not send message'));
    }
});

export const editMessage = createAsyncThunk<{ conversationID: number; messageID: number; messageText: string }, { conversationID: number; messageID: number; messageText: string }, { rejectValue: ApiError }>('conversation/editMessage', async (edit, { rejectWithValue }) => {
    try
    {
        await editMessageRequest(edit.messageID, { messageText: edit.messageText });
        return edit;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not edit message'));
    }
});

export const deleteMessage = createAsyncThunk<{ conversationID: number; messageID: number }, { conversationID: number; messageID: number }, { rejectValue: ApiError }>('conversation/deleteMessage', async (target, { rejectWithValue }) => {
    try
    {
        await deleteMessageRequest(target.messageID);
        return target;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not delete message'));
    }
});

export const markConversationRead = createAsyncThunk<{ conversationID: number; lastReadMessageID: number }, { conversationID: number; lastReadMessageID: number }, { rejectValue: ApiError }>('conversation/markConversationRead', async (target, { rejectWithValue }) => {
    try
    {
        await markConversationReadRequest(target.conversationID, target.lastReadMessageID);
        return target;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not mark conversation as read'));
    }
});

export const fetchMembers = createAsyncThunk<{ conversationID: number; members: UserResponse[] }, number, { rejectValue: ApiError }>('conversation/fetchMembers', async (conversationID, { rejectWithValue }) => {
    try
    {
        const members = await getConversationMembers(conversationID);

        return {
            conversationID,
            members
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not load members'));
    }
});

export const addMember = createAsyncThunk<{ conversationID: number; member: UserResponse }, { conversationID: number; username: string }, { rejectValue: ApiError }>('conversation/addMember', async ({ conversationID, username }, { rejectWithValue }) => {
    try
    {
        const member = await addMemberRequest(conversationID, username);

        return {
            conversationID,
            member
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not add member'));
    }
});

const conversationSlice = createSlice({
    name: 'conversation',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(clearTokens, () => initialState)
            .addCase(fetchConversations.pending, (state) => {
                state.conversationsStatus = 'loading';
                state.conversationsError = null;
            })
            .addCase(fetchConversations.fulfilled, (state, action) => {
                state.conversationsStatus = 'succeeded';
                state.hasLoadedConversations = true;
                state.conversations = action.payload;
            })
            .addCase(fetchConversations.rejected, (state, action) => {
                state.conversationsStatus = 'failed';
                state.conversationsError = action.payload ?? { message: 'Could not load conversations' };
            })
            .addCase(createConversation.fulfilled, (state, action) => {
                insertConversation(state, action.payload);
            })
            .addCase(createConversation.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not create conversation' };
            })
            .addCase(updateConversation.fulfilled, (state, action) => {
                const conversation = state.conversations.find(listedConversation => listedConversation.id === action.payload.id);

                // GET /conversations/{id} has no lastMessageID or unreadCount, so only take the fields that can change
                if (conversation)
                {
                    conversation.conversationName = action.payload.conversationName;
                    conversation.iconUrl = action.payload.iconUrl;
                    conversation.ownerUsername = action.payload.ownerUsername;
                }
            })
            .addCase(updateConversation.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not update conversation' };
            })
            .addCase(leaveConversation.fulfilled, (state, action) => {
                removeConversation(state, action.payload);
            })
            .addCase(leaveConversation.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not leave conversation' };
            })
            // keyed by conversation so a late response for one conversation can't change another's status
            .addCase(fetchMessages.pending, (state, action) => {
                state.messagesStatusByConversation[action.meta.arg.conversationID] = 'loading';
                state.messagesErrorByConversation[action.meta.arg.conversationID] = null;
            })
            .addCase(fetchMessages.fulfilled, (state, action) => {
                const { conversationID, before, messages, hasMore } = action.payload;

                state.messagesStatusByConversation[conversationID] = 'succeeded';
                state.hasMoreMessages[conversationID] = hasMore;

                // no before means a fresh load, otherwise it's an older page that goes in front
                if (before === undefined)
                {
                    state.messagesByConversation[conversationID] = messages;
                }
                else
                {
                    state.messagesByConversation[conversationID] = [...messages, ...(state.messagesByConversation[conversationID] ?? [])];
                }
            })
            .addCase(fetchMessages.rejected, (state, action) => {
                state.messagesStatusByConversation[action.meta.arg.conversationID] = 'failed';
                state.messagesErrorByConversation[action.meta.arg.conversationID] = action.payload ?? { message: 'Could not load messages' };
            })
            .addCase(sendMessage.fulfilled, (state, action) => {
                const { conversationID, message } = action.payload;

                addMessage(state, conversationID, message);
                bumpConversation(state, conversationID, message.id, true);
            })
            .addCase(sendMessage.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not send message' };
            })
            .addCase(editMessage.fulfilled, (state, action) => {
                const { conversationID, messageID, messageText } = action.payload;

                applyMessageEdit(state, conversationID, messageID, messageText);
            })
            .addCase(editMessage.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not edit message' };
            })
            .addCase(deleteMessage.fulfilled, (state, action) => {
                applyMessageDelete(state, action.payload.conversationID, action.payload.messageID);
            })
            .addCase(deleteMessage.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not delete message' };
            })
            .addCase(markConversationRead.fulfilled, (state, action) => {
                const conversation = state.conversations.find(listedConversation => listedConversation.id === action.payload.conversationID);

                if (conversation)
                {
                    conversation.unreadCount = 0;
                }
            })
            .addCase(fetchMembers.fulfilled, (state, action) => {
                state.membersByConversation[action.payload.conversationID] = action.payload.members;
            })
            .addCase(fetchMembers.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not load members' };
            })
            .addCase(addMember.fulfilled, (state, action) => {
                addListedMember(state, action.payload.conversationID, action.payload.member);
            })
            .addCase(addMember.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not add member' };
            })
            .addCase(conversationCreated, (state, action) => {
                insertConversation(state, action.payload.conversation);
            })
            .addCase(conversationMessageReceived, (state, action) => {
                const { conversationID, message, isOwnMessage } = action.payload;

                addMessage(state, conversationID, message);
                bumpConversation(state, conversationID, message.id, isOwnMessage);
            })
            .addCase(conversationMessageEdited, (state, action) => {
                const { conversationID, messageID, messageText } = action.payload;

                applyMessageEdit(state, conversationID, messageID, messageText);
            })
            .addCase(conversationMessageDeleted, (state, action) => {
                applyMessageDelete(state, action.payload.conversationID, action.payload.messageID);
            })
            .addCase(conversationUpdated, (state, action) => {
                const conversation = state.conversations.find(listedConversation => listedConversation.id === action.payload.conversationID);

                if (conversation)
                {
                    conversation.conversationName = action.payload.conversationName;
                    conversation.iconUrl = action.payload.iconUrl;
                }
            })
            .addCase(conversationMemberAdded, (state, action) => {
                addListedMember(state, action.payload.conversationID, action.payload.member);
            })
            .addCase(conversationMemberRemoved, (state, action) => {
                removeListedMember(state, action.payload.conversationID, action.payload.username);
            })
            .addCase(conversationOwnerChanged, (state, action) => {
                const conversation = state.conversations.find(listedConversation => listedConversation.id === action.payload.conversationID);

                if (conversation)
                {
                    conversation.ownerUsername = action.payload.ownerUsername;
                }
            })
            .addCase(conversationRemoved, (state, action) => {
                removeConversation(state, action.payload.conversationID);
            })
            .addCase(conversationReadStateUpdated, (state, action) => {
                const conversation = state.conversations.find(listedConversation => listedConversation.id === action.payload.conversationID);

                if (conversation)
                {
                    conversation.unreadCount = action.payload.unreadCount;
                }
            })
            .addCase(userStatusChanged, (state, action) => {
                for (const members of Object.values(state.membersByConversation))
                {
                    const member = members.find(listedMember => listedMember.username === action.payload.username);

                    if (member)
                    {
                        member.activityStatus = action.payload.status;
                    }
                }
            })
            .addCase(userUpdated, (state, action) => {
                const { username, displayName, profileImageUrl } = action.payload;

                for (const members of Object.values(state.membersByConversation))
                {
                    const member = members.find(listedMember => listedMember.username === username);

                    if (member)
                    {
                        member.displayName = displayName;
                        member.profileImageUrl = profileImageUrl;
                    }
                }

                // a dm is shown under the other person's name and avatar
                for (const conversation of state.conversations)
                {
                    if (conversation.otherUsername === username)
                    {
                        conversation.conversationName = displayName;
                        conversation.iconUrl = profileImageUrl;
                    }
                }

                for (const messages of Object.values(state.messagesByConversation))
                {
                    updateSenderProfile(messages, username, displayName, profileImageUrl);
                }
            });
    }
});

export default conversationSlice.reducer;