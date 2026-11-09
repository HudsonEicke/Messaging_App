import type { HubConnection } from '@microsoft/signalr';
import { store } from '@/store/store';
import { conversationCreated, conversationMemberAdded, conversationMemberRemoved, conversationMessageDeleted, conversationMessageEdited, conversationMessageReceived, conversationOwnerChanged, conversationRemoved, conversationUpdated } from '@/store/hubEvents';
import { onHubEvent } from '@/services/hub/events';

const isCurrentUser = (username: string) => username === store.getState().user.user?.username;

export const registerConversationEvents = (connection: HubConnection) =>
{
    onHubEvent(connection, 'ConversationCreated', (conversation) =>
    {
        store.dispatch(conversationCreated({ conversation }));
    });

    onHubEvent(connection, 'ReceiveConversationMessage', (conversationID, message) =>
    {
        store.dispatch(conversationMessageReceived({ conversationID, message: { ...message, edited: false }, isOwnMessage: isCurrentUser(message.senderUsername) }));
    });

    onHubEvent(connection, 'ConversationMessageEdited', (conversationID, messageID, messageText) =>
    {
        store.dispatch(conversationMessageEdited({ conversationID, messageID, messageText }));
    });

    onHubEvent(connection, 'ConversationMessageDeleted', (conversationID, messageID) =>
    {
        store.dispatch(conversationMessageDeleted({ conversationID, messageID }));
    });

    onHubEvent(connection, 'ConversationUpdated', (conversationID, conversationName, iconUrl) =>
    {
        store.dispatch(conversationUpdated({ conversationID, conversationName, iconUrl }));
    });

    onHubEvent(connection, 'ConversationMemberAdded', (conversationID, member) =>
    {
        store.dispatch(conversationMemberAdded({ conversationID, member }));
    });

    onHubEvent(connection, 'ConversationOwnerChanged', (conversationID, ownerUsername) =>
    {
        store.dispatch(conversationOwnerChanged({ conversationID, ownerUsername }));
    });

    // sent before the leaver is taken out of the group, so your other tabs hear about your own leave
    onHubEvent(connection, 'ConversationMemberLeft', (conversationID, username) =>
    {
        store.dispatch(isCurrentUser(username) ? conversationRemoved({ conversationID }) : conversationMemberRemoved({ conversationID, username }));
    });
};
