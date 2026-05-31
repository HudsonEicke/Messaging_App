export interface SendMessageResponse
{
    id: number;
    messageText: string;
    senderUsername: string;
    senderDisplayName: string;
    timeSent: string;
    replyToID?: number;
}