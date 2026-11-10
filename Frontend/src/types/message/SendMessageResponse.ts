import type { MessageReplyPreview } from './MessageReplyPreview';

export interface SendMessageResponse
{
    id: number;
    messageText: string;
    senderUsername: string;
    senderDisplayName: string;
    senderProfileImageUrl: string;
    timeSent: string;
    isReply: boolean;
    replyToID?: number;
    replyTo: MessageReplyPreview | null;
}