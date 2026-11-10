import type { HubConnection } from '@microsoft/signalr';
import { store } from '@/store/store';
import { conversationCreated, conversationMemberAdded, conversationMemberRemoved, conversationMessageDeleted, conversationMessageEdited, conversationMessageReceived, conversationOwnerChanged, conversationReadStateUpdated, conversationRemoved, conversationUpdated } from '@/store/hubEvents';
import { markConversationRead } from '@/store/conversationSlice';
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
        const isOwnMessage = isCurrentUser(message.senderUsername);
        // MessageList only marks read when the badge is showing, so a message arriving where you're reading is marked here
        const isBeingRead = !isOwnMessage && store.getState().reading.conversationID === conversationID;

        store.dispatch(conversationMessageReceived({ conversationID, message: { ...message, edited: false }, isRead: isOwnMessage || isBeingRead }));

        if (isBeingRead)
        {
            store.dispatch(markConversationRead({ conversationID, lastReadMessageID: message.id }));
        }
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

    // sent to all your tabs when one of them marks a conversation read
    onHubEvent(connection, 'ConversationReadStateUpdated', (conversationID, unreadCount) =>
    {
        store.dispatch(conversationReadStateUpdated({ conversationID, unreadCount }));
    });
};
