import { createAction } from '@reduxjs/toolkit';
import type { MessageResponse } from '@/types';

// one action per SignalR event, kept apart from the slices so any slice can respond without importing another
export const channelMessageReceived = createAction<{ serverID: number; channelID: number; message: MessageResponse; isOwnMessage: boolean }>('hub/channelMessageReceived');
export const channelMessageEdited = createAction<{ channelID: number; messageID: number; messageText: string }>('hub/channelMessageEdited');
export const channelMessageDeleted = createAction<{ channelID: number; messageID: number }>('hub/channelMessageDeleted');
