import type { HubConnection } from '@microsoft/signalr';
import { store } from '@/store/store';
import { channelCreated, channelDeleted, channelMessageDeleted, channelMessageEdited, channelMessageReceived, channelReadStateUpdated, channelsReordered, channelUpdated } from '@/store/hubEvents';
import { markChannelRead } from '@/store/channelSlice';
import { onHubEvent } from '@/services/hub/events';

export const registerChannelEvents = (connection: HubConnection) =>
{
    onHubEvent(connection, 'ReceiveChannelMessage', (serverID, channelID, message) =>
    {
        const state = store.getState();
        const isOwnMessage = message.senderUsername === state.user.user?.username;
        // MessageList only marks read when the dot is showing, so a message arriving where you're reading is marked here
        const isBeingRead = !isOwnMessage && state.reading.channelID === channelID;

        store.dispatch(channelMessageReceived({ serverID, channelID, message: { ...message, edited: false }, isRead: isOwnMessage || isBeingRead }));

        if (isBeingRead)
        {
            store.dispatch(markChannelRead({ channelID, lastReadMessageID: message.id }));
        }
    });

    onHubEvent(connection, 'ChannelMessageEdited', (channelID, messageID, messageText) =>
    {
        store.dispatch(channelMessageEdited({ channelID, messageID, messageText }));
    });

    onHubEvent(connection, 'ChannelMessageDeleted', (channelID, messageID) =>
    {
        store.dispatch(channelMessageDeleted({ channelID, messageID }));
    });

    onHubEvent(connection, 'ChannelCreated', (serverID, channel) =>
    {
        store.dispatch(channelCreated({ serverID, channel: { ...channel, hasUnread: false } }));
    });

    onHubEvent(connection, 'ChannelUpdated', (channelID, channelName) =>
    {
        store.dispatch(channelUpdated({ channelID, channelName }));
    });

    onHubEvent(connection, 'ChannelsReordered', (serverID, channelIDs) =>
    {
        store.dispatch(channelsReordered({ serverID, channelIDs }));
    });

    // the page redirects on its own if you were viewing the deleted channel
    onHubEvent(connection, 'ChannelDeleted', (channelID) =>
    {
        store.dispatch(channelDeleted({ channelID }));
    });

    // sent to all your tabs when one of them marks a channel read
    onHubEvent(connection, 'ChannelReadStateUpdated', (serverID, channelID, channelHasUnread, serverHasUnread) =>
    {
        store.dispatch(channelReadStateUpdated({ serverID, channelID, channelHasUnread, serverHasUnread }));
    });
};
