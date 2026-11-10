import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { clearTokens } from './authSlice';

// the channel or conversation you're reading right now: its list is scrolled to the bottom and the window has focus;
// the hub handlers use it so a message arriving there doesn't flash the unread dot
interface ReadingState
{
    channelID: number | null;
    conversationID: number | null;
}

const initialState: ReadingState = {
    channelID: null,
    conversationID: null
};

const readingSlice = createSlice({
    name: 'reading',
    initialState,
    reducers: {
        startReadingChannel: (state, action: PayloadAction<number>) => {
            state.channelID = action.payload;
        },
        // only clears if it's still the same one, in case the next list started reading first
        stopReadingChannel: (state, action: PayloadAction<number>) => {
            if (state.channelID === action.payload)
            {
                state.channelID = null;
            }
        },
        startReadingConversation: (state, action: PayloadAction<number>) => {
            state.conversationID = action.payload;
        },
        stopReadingConversation: (state, action: PayloadAction<number>) => {
            if (state.conversationID === action.payload)
            {
                state.conversationID = null;
            }
        }
    },
    extraReducers: (builder) => {
        builder.addCase(clearTokens, () => initialState);
    }
});

export const { startReadingChannel, stopReadingChannel, startReadingConversation, stopReadingConversation } = readingSlice.actions;
export default readingSlice.reducer;
