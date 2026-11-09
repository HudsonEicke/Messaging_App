import type { HubConnection } from '@microsoft/signalr';
import { store } from '@/store/store';
import { serverMemberJoined, serverMemberRemoved, serverOwnerChanged, serverRemoved } from '@/store/hubEvents';
import { onHubEvent } from '@/services/hub/events';

const isCurrentUser = (username: string) => username === store.getState().user.user?.username;

// the backend sends these before taking the user out of the server's group, so you hear about your own leave or kick too
const handleMemberRemoved = (serverID: number, username: string) =>
{
    store.dispatch(isCurrentUser(username) ? serverRemoved({ serverID }) : serverMemberRemoved({ serverID, username }));
};

export const registerServerEvents = (connection: HubConnection) =>
{
    onHubEvent(connection, 'MemberJoined', (serverID, member) =>
    {
        store.dispatch(serverMemberJoined({ serverID, member }));
    });

    onHubEvent(connection, 'MemberLeft', handleMemberRemoved);
    onHubEvent(connection, 'MemberKicked', handleMemberRemoved);

    onHubEvent(connection, 'OwnerChanged', (serverID, ownerUsername) =>
    {
        store.dispatch(serverOwnerChanged({ serverID, ownerUsername }));
    });
};
