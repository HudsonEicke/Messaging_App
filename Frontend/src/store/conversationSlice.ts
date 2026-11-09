import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from './store';
import type { ConversationResponse, CreateConversationRequest, MessageResponse, SendMessageRequest, UpdateConversationRequest, UserResponse } from '@/types';
import type { ApiError } from '@/lib/utils';
import { getApiError } from '@/lib/utils';
import { shortenReplyPreview } from '@/lib/replyPreview';
import { clearTokens } from './authSlice';
import { getConversations, getConversation, createConversation as createConversationRequest, updateConversation as updateConversationRequest, leaveConversation as leaveConversationRequest, getMessages, sendMessage as sendMessageRequest, editMessage as editMessageRequest, deleteMessage as deleteMessageRequest, getConversationMembers, addMember as addMemberRequest, markConversationRead as markConversationReadRequest } from '@/services/conversationService';

const MESSAGE_PAGE_SIZE = 50;

type FetchStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface ConversationState
{
    conversations: ConversationResponse[];
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
    messagesByConversation: {},
    hasMoreMessages: {},
    membersByConversation: {},
    conversationsStatus: 'idle',
    conversationsError: null,
    messagesStatusByConversation: {},
    messagesErrorByConversation: {},
    error: null
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
                state.conversations = action.payload;
            })
            .addCase(fetchConversations.rejected, (state, action) => {
                state.conversationsStatus = 'failed';
                state.conversationsError = action.payload ?? { message: 'Could not load conversations' };
            })
            .addCase(createConversation.fulfilled, (state, action) => {
                const alreadyListed = state.conversations.some((conversation) => conversation.id === action.payload.id);

                if (!alreadyListed)
                {
                    state.conversations.push(action.payload);
                }
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
                const id = action.payload;

                state.conversations = state.conversations.filter(conversation => conversation.id !== id);
                delete state.messagesByConversation[id];
                delete state.hasMoreMessages[id];
                delete state.membersByConversation[id];
                delete state.messagesStatusByConversation[id];
                delete state.messagesErrorByConversation[id];
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
                const messages = state.messagesByConversation[conversationID] ?? [];

                // SignalR will also deliver your own message, so it may already be listed
                if (!messages.some(listedMessage => listedMessage.id === message.id))
                {
                    state.messagesByConversation[conversationID] = [...messages, message];
                }

                // the backend marks your own message read, and the list is sorted by recent activity
                const conversationIndex = state.conversations.findIndex(conversation => conversation.id === conversationID);

                if (conversationIndex !== -1)
                {
                    const [conversation] = state.conversations.splice(conversationIndex, 1);
                    conversation.lastMessageID = message.id;
                    conversation.unreadCount = 0;
                    state.conversations.unshift(conversation);
                }
            })
            .addCase(sendMessage.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not send message' };
            })
            .addCase(editMessage.fulfilled, (state, action) => {
                const { conversationID, messageID, messageText } = action.payload;

                for (const message of state.messagesByConversation[conversationID] ?? [])
                {
                    if (message.id === messageID)
                    {
                        message.messageText = messageText;
                        message.edited = true;
                    }
                    else if (message.replyTo?.id === messageID)
                    {
                        message.replyTo.messageText = shortenReplyPreview(messageText);
                    }
                }
            })
            .addCase(editMessage.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not edit message' };
            })
            .addCase(deleteMessage.fulfilled, (state, action) => {
                const { conversationID, messageID } = action.payload;
                const messages = state.messagesByConversation[conversationID];

                if (messages)
                {
                    // the backend clears replyToID on replies to a deleted message
                    state.messagesByConversation[conversationID] = messages
                        .filter(message => message.id !== messageID)
                        .map(message => message.replyTo?.id === messageID ? { ...message, replyToID: undefined, replyTo: null } : message);
                }
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
                const { conversationID, member } = action.payload;

                // only add to a list that was already loaded, otherwise it would look like a one member group
                state.membersByConversation[conversationID]?.push(member);
            })
            .addCase(addMember.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not add member' };
            });
    }
});

export default conversationSlice.reducer;