import type { HubConnection } from '@microsoft/signalr';
import { store } from '@/store/store';
import { channelMessageDeleted, channelMessageEdited, channelMessageReceived } from '@/store/hubEvents';
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
};
