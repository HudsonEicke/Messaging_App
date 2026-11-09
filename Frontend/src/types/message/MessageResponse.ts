import type { MessageReplyPreview } from './MessageReplyPreview';

export interface MessageResponse
{
    id: number;
    messageText: string;
    senderUsername: string;
    senderDisplayName: string;
    senderProfileImageUrl: string;
    timeSent: string;
    edited: boolean;
    replyToID?: number;
    replyTo: MessageReplyPreview | null;
}