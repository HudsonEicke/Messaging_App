import type { HubConnection } from '@microsoft/signalr';
import { store } from '@/store/store';
import { channelCreated, channelDeleted, channelMessageDeleted, channelMessageEdited, channelMessageReceived, channelsReordered, channelUpdated } from '@/store/hubEvents';
import { onHubEvent } from '@/services/hub/events';

export const registerChannelEvents = (connection: HubConnection) =>
{
    onHubEvent(connection, 'ReceiveChannelMessage', (serverID, channelID, message) =>
    {
        const isOwnMessage = message.senderUsername === store.getState().user.user?.username;

        store.dispatch(channelMessageReceived({ serverID, channelID, message: { ...message, edited: false }, isOwnMessage }));
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
};
