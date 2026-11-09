import type { HubConnection } from '@microsoft/signalr';
import type { ActivityStatus, CreateChannelResponse, SendMessageResponse, UserResponse } from '@/types';

// every server-to-client event the client handles, with the arguments the backend sends it
// events whose payloads are still missing an id are added as each one is fixed and wired up
export interface HubEventMap
{
    ChannelCreated: [serverID: number, channel: CreateChannelResponse];
    ChannelUpdated: [channelID: number, channelName: string];
    ChannelsReordered: [serverID: number, channelIDs: number[]];
    ChannelDeleted: [channelID: number];
    ReceiveChannelMessage: [serverID: number, channelID: number, message: SendMessageResponse];
    ChannelMessageEdited: [channelID: number, messageID: number, messageText: string];
    ChannelMessageDeleted: [channelID: number, messageID: number];
    ConversationMessageEdited: [conversationID: number, messageID: number, messageText: string];
    ConversationMessageDeleted: [conversationID: number, messageID: number];
    MemberJoined: [serverID: number, member: UserResponse];
    MemberLeft: [serverID: number, username: string];
    MemberKicked: [serverID: number, username: string];
    OwnerChanged: [serverID: number, ownerUsername: string];
    ServerUpdated: [serverID: number, serverName: string, iconUrl: string];
    ServerDeleted: [serverID: number];
    UserStatusChanged: [username: string, status: ActivityStatus];
    UserUpdated: [username: string, displayName: string, profileImageUrl: string];
}

export const onHubEvent = <EventName extends keyof HubEventMap>(
    connection: HubConnection,
    eventName: EventName,
    handler: (...args: HubEventMap[EventName]) => void
) => {
    connection.on(eventName, handler);
};
