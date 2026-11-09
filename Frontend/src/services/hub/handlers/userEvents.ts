import type { HubConnection } from '@microsoft/signalr';
import { store } from '@/store/store';
import { userStatusChanged, userUpdated } from '@/store/hubEvents';
import { onHubEvent } from '@/services/hub/events';

export const registerUserEvents = (connection: HubConnection) =>
{
    onHubEvent(connection, 'UserStatusChanged', (username, status) =>
    {
        store.dispatch(userStatusChanged({ username, status }));
    });

    onHubEvent(connection, 'UserUpdated', (username, displayName, profileImageUrl) =>
    {
        store.dispatch(userUpdated({ username, displayName, profileImageUrl }));
    });
};
