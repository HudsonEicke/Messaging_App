import type { HubConnection } from '@microsoft/signalr';
import { store } from '@/store/store';
import { userStatusChanged } from '@/store/hubEvents';
import { onHubEvent } from '@/services/hub/events';

export const registerUserEvents = (connection: HubConnection) =>
{
    onHubEvent(connection, 'UserStatusChanged', (username, status) =>
    {
        store.dispatch(userStatusChanged({ username, status }));
    });
};
