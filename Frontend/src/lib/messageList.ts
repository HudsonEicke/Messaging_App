import type { MessageResponse } from '@/types';
import { shortenReplyPreview } from './replyPreview';

// shared by the channel and conversation slices; these change the array in place, so pass them an Immer draft

export const insertMessage = (messages: MessageResponse[], message: MessageResponse) =>
{
    // the hub also delivers your own message, so it may already be listed
    if (messages.some(listedMessage => listedMessage.id === message.id))
    {
        return;
    }

    // ids only go up, so two messages that arrive out of order still end up oldest first
    let index = messages.length;

    while (index > 0 && messages[index - 1].id > message.id)
    {
        index--;
    }

    messages.splice(index, 0, message);
};

export const editMessageText = (messages: MessageResponse[], messageID: number, messageText: string) =>
{
    for (const message of messages)
    {
        if (message.id === messageID)
        {
            message.messageText = messageText;
            message.edited = true;
        }
        else if (message.replyTo?.id === messageID)
        {
            message.replyTo.messageText = shortenReplyPreview(messageText);
        }
    }
};

export const removeMessage = (messages: MessageResponse[], messageID: number) =>
{
    const index = messages.findIndex(message => message.id === messageID);

    if (index !== -1)
    {
        messages.splice(index, 1);
    }

    // the backend clears replyToID on replies to a deleted message
    for (const message of messages)
    {
        if (message.replyTo?.id === messageID)
        {
            message.replyToID = undefined;
            message.replyTo = null;
        }
    }
};

// old messages show the sender's current name and avatar, as a refetch would
export const updateSenderProfile = (messages: MessageResponse[], username: string, displayName: string, profileImageUrl: string) =>
{
    for (const message of messages)
    {
        if (message.senderUsername === username)
        {
            message.senderDisplayName = displayName;
            message.senderProfileImageUrl = profileImageUrl;
        }

        if (message.replyTo?.senderUsername === username)
        {
            message.replyTo.senderDisplayName = displayName;
            message.replyTo.senderProfileImageUrl = profileImageUrl;
        }
    }
};
