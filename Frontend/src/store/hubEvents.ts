import { createAction } from '@reduxjs/toolkit';
import type { ChannelResponse, MessageResponse, UserResponse } from '@/types';

// one action per SignalR event, kept apart from the slices so any slice can respond without importing another
export const channelMessageReceived = createAction<{ serverID: number; channelID: number; message: MessageResponse; isOwnMessage: boolean }>('hub/channelMessageReceived');
export const channelMessageEdited = createAction<{ channelID: number; messageID: number; messageText: string }>('hub/channelMessageEdited');
export const channelMessageDeleted = createAction<{ channelID: number; messageID: number }>('hub/channelMessageDeleted');
export const channelCreated = createAction<{ serverID: number; channel: ChannelResponse }>('hub/channelCreated');
export const channelUpdated = createAction<{ channelID: number; channelName: string }>('hub/channelUpdated');
export const channelsReordered = createAction<{ serverID: number; channelIDs: number[] }>('hub/channelsReordered');
export const channelDeleted = createAction<{ channelID: number }>('hub/channelDeleted');
export const serverMemberJoined = createAction<{ serverID: number; member: UserResponse }>('hub/serverMemberJoined');
export const serverMemberRemoved = createAction<{ serverID: number; username: string }>('hub/serverMemberRemoved');
export const serverOwnerChanged = createAction<{ serverID: number; ownerUsername: string }>('hub/serverOwnerChanged');
export const serverUpdated = createAction<{ serverID: number; serverName: string; iconUrl: string }>('hub/serverUpdated');
export const serverRemoved = createAction<{ serverID: number }>('hub/serverRemoved');
export const conversationMessageReceived = createAction<{ conversationID: number; message: MessageResponse; isOwnMessage: boolean }>('hub/conversationMessageReceived');
export const conversationMessageEdited = createAction<{ conversationID: number; messageID: number; messageText: string }>('hub/conversationMessageEdited');
export const conversationMessageDeleted = createAction<{ conversationID: number; messageID: number }>('hub/conversationMessageDeleted');
export const conversationUpdated = createAction<{ conversationID: number; conversationName: string; iconUrl: string }>('hub/conversationUpdated');
export const conversationMemberAdded = createAction<{ conversationID: number; member: UserResponse }>('hub/conversationMemberAdded');
export const conversationMemberRemoved = createAction<{ conversationID: number; username: string }>('hub/conversationMemberRemoved');
export const conversationOwnerChanged = createAction<{ conversationID: number; ownerUsername: string }>('hub/conversationOwnerChanged');
export const conversationRemoved = createAction<{ conversationID: number }>('hub/conversationRemoved');
