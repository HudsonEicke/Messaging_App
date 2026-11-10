import type { HubConnection } from '@microsoft/signalr';
import { store } from '@/store/store';
import { friendAdded, friendRemoved, friendRequestReceived, friendRequestSent, userBlocked, userUnblocked } from '@/store/hubEvents';
import { onHubEvent } from '@/services/hub/events';

// each of these goes to all of the affected user's tabs, including the one that made the request
export const registerFriendEvents = (connection: HubConnection) =>
{
    onHubEvent(connection, 'FriendRequestReceived', (user) =>
    {
        store.dispatch(friendRequestReceived({ user }));
    });

    onHubEvent(connection, 'FriendRequestSent', (user) =>
    {
        store.dispatch(friendRequestSent({ user }));
    });

    onHubEvent(connection, 'FriendAdded', (user) =>
    {
        store.dispatch(friendAdded({ user }));
    });

    // sent for a declined or cancelled request, an unfriend, and to someone you block
    onHubEvent(connection, 'FriendRemoved', (username) =>
    {
        store.dispatch(friendRemoved({ username }));
    });

    onHubEvent(connection, 'UserBlocked', (user) =>
    {
        store.dispatch(userBlocked({ user }));
    });

    onHubEvent(connection, 'UserUnblocked', (username) =>
    {
        store.dispatch(userUnblocked({ username }));
    });
};
