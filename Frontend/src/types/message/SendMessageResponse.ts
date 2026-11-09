export interface SendMessageResponse
{
    id: number;
    messageText: string;
    senderUsername: string;
    senderDisplayName: string;
    senderProfileImageUrl: string;
    timeSent: string;
    replyToID?: number;
}