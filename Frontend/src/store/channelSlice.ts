import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { MessageResponse, SendMessageRequest } from '@/types';
import type { RootState } from './store';
import type { ApiError } from '@/lib/utils';
import { getApiError } from '@/lib/utils';
import { editMessageText, insertMessage, removeMessage, updateSenderProfile } from '@/lib/messageList';
import { clearTokens } from './authSlice';
import { channelDeleted, channelMessageDeleted, channelMessageEdited, channelMessageReceived, userUpdated } from './hubEvents';
import { updateChannel as updateChannelRequest, deleteChannel as deleteChannelRequest, getMessages, sendMessage as sendMessageRequest, editMessage as editMessageRequest, deleteMessage as deleteMessageRequest, markChannelRead as markChannelReadRequest } from '@/services/channelService';

const MESSAGE_PAGE_SIZE = 50;

type FetchStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface ChannelState
{
    messagesByChannel: Record<number, MessageResponse[]>;
    hasMoreMessages: Record<number, boolean>;
    messagesStatusByChannel: Record<number, FetchStatus>;
    messagesErrorByChannel: Record<number, ApiError | null>;
    error: ApiError | null;
}

const initialState: ChannelState = {
    messagesByChannel: {},
    hasMoreMessages: {},
    messagesStatusByChannel: {},
    messagesErrorByChannel: {},
    error: null
};

// shared by the thunks and the hub events; a channel that hasn't been opened has no cache to change
const addMessage = (state: ChannelState, channelID: number, message: MessageResponse) => {
    const messages = state.messagesByChannel[channelID];

    if (messages)
    {
        insertMessage(messages, message);
    }
};

const applyMessageEdit = (state: ChannelState, channelID: number, messageID: number, messageText: string) => {
    const messages = state.messagesByChannel[channelID];

    if (messages)
    {
        editMessageText(messages, messageID, messageText);
    }
};

const applyMessageDelete = (state: ChannelState, channelID: number, messageID: number) => {
    const messages = state.messagesByChannel[channelID];

    if (messages)
    {
        removeMessage(messages, messageID);
    }
};

const dropChannelCache = (state: ChannelState, channelID: number) => {
    delete state.messagesByChannel[channelID];
    delete state.hasMoreMessages[channelID];
    delete state.messagesStatusByChannel[channelID];
    delete state.messagesErrorByChannel[channelID];
};

export const updateChannel = createAsyncThunk<{ serverID: number; channelID: number; channelName: string }, { serverID: number; channelID: number; channelName: string }, { rejectValue: ApiError }>('channel/updateChannel', async ({ serverID, channelID, channelName }, { rejectWithValue }) => {
    try
    {
        await updateChannelRequest(channelID, { channelName });

        // backend returns no body but saves the trimmed name
        return {
            serverID,
            channelID,
            channelName: channelName.trim()
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not update channel'));
    }
});

export const deleteChannel = createAsyncThunk<{ serverID: number; channelID: number }, { serverID: number; channelID: number }, { rejectValue: ApiError }>('channel/deleteChannel', async (target, { rejectWithValue }) => {
    try
    {
        await deleteChannelRequest(target.channelID);
        return target;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not delete channel'));
    }
});

export const fetchMessages = createAsyncThunk<{ channelID: number; before?: number; messages: MessageResponse[]; hasMore: boolean }, { channelID: number; before?: number }, { state: RootState; rejectValue: ApiError }>('channel/fetchMessages', async ({ channelID, before }, { rejectWithValue }) => {
    try
    {
        const page = await getMessages(channelID, before);

        // backend sends newest first, store oldest first so the list renders top to bottom
        return {
            channelID,
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
    condition: ({ channelID }, { getState }) => getState().channel.messagesStatusByChannel[channelID] !== 'loading'
});

export const sendMessage = createAsyncThunk<{ channelID: number; message: MessageResponse }, { channelID: number; request: SendMessageRequest }, { rejectValue: ApiError }>('channel/sendMessage', async ({ channelID, request }, { rejectWithValue }) => {
    try
    {
        const result = await sendMessageRequest(channelID, request);

        return {
            channelID,
            message: { ...result, edited: false }
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not send message'));
    }
});

export const editMessage = createAsyncThunk<{ channelID: number; messageID: number; messageText: string }, { channelID: number; messageID: number; messageText: string }, { rejectValue: ApiError }>('channel/editMessage', async (edit, { rejectWithValue }) => {
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

export const deleteMessage = createAsyncThunk<{ channelID: number; messageID: number }, { channelID: number; messageID: number }, { rejectValue: ApiError }>('channel/deleteMessage', async (target, { rejectWithValue }) => {
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

export const markChannelRead = createAsyncThunk<{ channelID: number; lastReadMessageID: number }, { channelID: number; lastReadMessageID: number }, { rejectValue: ApiError }>('channel/markChannelRead', async (target, { rejectWithValue }) => {
    try
    {
        await markChannelReadRequest(target.channelID, target.lastReadMessageID);
        return target;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not mark channel as read'));
    }
});

const channelSlice = createSlice({
    name: 'channel',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // clearTokens fires on logout and when the token refresh fails, so reset everything
            .addCase(clearTokens, () => initialState)
            .addCase(updateChannel.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not update channel' };
            })
            .addCase(deleteChannel.fulfilled, (state, action) => {
                dropChannelCache(state, action.payload.channelID);
            })
            .addCase(channelDeleted, (state, action) => {
                dropChannelCache(state, action.payload.channelID);
            })
            .addCase(deleteChannel.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not delete channel' };
            })
            // keyed by channel so a late response for one channel can't change another's status
            .addCase(fetchMessages.pending, (state, action) => {
                state.messagesStatusByChannel[action.meta.arg.channelID] = 'loading';
                state.messagesErrorByChannel[action.meta.arg.channelID] = null;
            })
            .addCase(fetchMessages.fulfilled, (state, action) => {
                const { channelID, before, messages, hasMore } = action.payload;

                state.messagesStatusByChannel[channelID] = 'succeeded';
                state.hasMoreMessages[channelID] = hasMore;

                // no before means a fresh load, otherwise it's an older page that goes in front
                if (before === undefined)
                {
                    state.messagesByChannel[channelID] = messages;
                }
                else
                {
                    state.messagesByChannel[channelID] = [...messages, ...(state.messagesByChannel[channelID] ?? [])];
                }
            })
            .addCase(fetchMessages.rejected, (state, action) => {
                state.messagesStatusByChannel[action.meta.arg.channelID] = 'failed';
                state.messagesErrorByChannel[action.meta.arg.channelID] = action.payload ?? { message: 'Could not load messages' };
            })
            .addCase(sendMessage.fulfilled, (state, action) => {
                addMessage(state, action.payload.channelID, action.payload.message);
            })
            .addCase(sendMessage.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not send message' };
            })
            .addCase(editMessage.fulfilled, (state, action) => {
                const { channelID, messageID, messageText } = action.payload;

                applyMessageEdit(state, channelID, messageID, messageText);
            })
            .addCase(editMessage.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not edit message' };
            })
            .addCase(deleteMessage.fulfilled, (state, action) => {
                applyMessageDelete(state, action.payload.channelID, action.payload.messageID);
            })
            .addCase(deleteMessage.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not delete message' };
            })
            .addCase(channelMessageReceived, (state, action) => {
                addMessage(state, action.payload.channelID, action.payload.message);
            })
            .addCase(channelMessageEdited, (state, action) => {
                const { channelID, messageID, messageText } = action.payload;

                applyMessageEdit(state, channelID, messageID, messageText);
            })
            .addCase(channelMessageDeleted, (state, action) => {
                applyMessageDelete(state, action.payload.channelID, action.payload.messageID);
            })
            .addCase(userUpdated, (state, action) => {
                const { username, displayName, profileImageUrl } = action.payload;

                for (const messages of Object.values(state.messagesByChannel))
                {
                    updateSenderProfile(messages, username, displayName, profileImageUrl);
                }
            });
    }
});

export default channelSlice.reducer;
