export interface MessageResponse
{
    id: number;
    messageText: string;
    senderUsername: string;
    senderDisplayName: string;
    timeSent: string;
    edited: boolean;
    replyToID?: number;
}