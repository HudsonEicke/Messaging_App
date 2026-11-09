import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { MessageResponse, SendMessageRequest } from '@/types';
import type { RootState } from './store';
import type { ApiError } from '@/lib/utils';
import { getApiError } from '@/lib/utils';
import { shortenReplyPreview } from '@/lib/replyPreview';
import { clearTokens } from './authSlice';
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
                const { channelID } = action.payload;

                delete state.messagesByChannel[channelID];
                delete state.hasMoreMessages[channelID];
                delete state.messagesStatusByChannel[channelID];
                delete state.messagesErrorByChannel[channelID];
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
                const { channelID, message } = action.payload;
                const messages = state.messagesByChannel[channelID] ?? [];

                // SignalR will also deliver your own message, so it may already be listed
                if (!messages.some(listedMessage => listedMessage.id === message.id))
                {
                    state.messagesByChannel[channelID] = [...messages, message];
                }
            })
            .addCase(sendMessage.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not send message' };
            })
            .addCase(editMessage.fulfilled, (state, action) => {
                const { channelID, messageID, messageText } = action.payload;

                for (const message of state.messagesByChannel[channelID] ?? [])
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
                const { channelID, messageID } = action.payload;
                const messages = state.messagesByChannel[channelID];

                if (messages)
                {
                    // the backend clears replyToID on replies to a deleted message
                    state.messagesByChannel[channelID] = messages
                        .filter(message => message.id !== messageID)
                        .map(message => message.replyTo?.id === messageID ? { ...message, replyToID: undefined, replyTo: null } : message);
                }
            })
            .addCase(deleteMessage.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not delete message' };
            });
    }
});

export default channelSlice.reducer;
