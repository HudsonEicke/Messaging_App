import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { MessageResponse, SendMessageRequest } from '@/types';
import type { ApiError } from '@/lib/utils';
import { getApiError } from '@/lib/utils';
import { clearTokens } from './authSlice';
import { updateChannel as updateChannelRequest, deleteChannel as deleteChannelRequest, getMessages, sendMessage as sendMessageRequest, editMessage as editMessageRequest, deleteMessage as deleteMessageRequest } from '@/services/channelService';

const MESSAGE_PAGE_SIZE = 50;

interface ChannelState
{
    activeChannelID: number | null;
    messagesByChannel: Record<number, MessageResponse[]>;
    hasMoreMessages: Record<number, boolean>;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: ApiError | null;
}

const initialState: ChannelState = {
    activeChannelID: null,
    messagesByChannel: {},
    hasMoreMessages: {},
    status: 'idle',
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

export const fetchMessages = createAsyncThunk<{ channelID: number; before?: number; messages: MessageResponse[]; hasMore: boolean }, { channelID: number; before?: number }, { rejectValue: ApiError }>('channel/fetchMessages', async ({ channelID, before }, { rejectWithValue }) => {
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

const channelSlice = createSlice({
    name: 'channel',
    initialState,
    reducers: {
        setActiveChannel: (state, action: PayloadAction<number | null>) => {
            state.activeChannelID = action.payload;
        }
    },
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

                if (state.activeChannelID === channelID)
                {
                    state.activeChannelID = null;
                }
            })
            .addCase(deleteChannel.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not delete channel' };
            })
            .addCase(fetchMessages.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(fetchMessages.fulfilled, (state, action) => {
                const { channelID, before, messages, hasMore } = action.payload;

                state.status = 'succeeded';
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
                state.status = 'failed';
                state.error = action.payload ?? { message: 'Could not load messages' };
            })
            .addCase(sendMessage.fulfilled, (state, action) => {
                const { channelID, message } = action.payload;

                state.messagesByChannel[channelID] = [...(state.messagesByChannel[channelID] ?? []), message];
            })
            .addCase(sendMessage.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not send message' };
            })
            .addCase(editMessage.fulfilled, (state, action) => {
                const { channelID, messageID, messageText } = action.payload;
                const message = state.messagesByChannel[channelID]?.find(message => message.id === messageID);

                if (message)
                {
                    message.messageText = messageText;
                    message.edited = true;
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
                    state.messagesByChannel[channelID] = messages.filter(message => message.id !== messageID);
                }
            })
            .addCase(deleteMessage.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not delete message' };
            });
    }
});

export const { setActiveChannel } = channelSlice.actions;
export default channelSlice.reducer;
