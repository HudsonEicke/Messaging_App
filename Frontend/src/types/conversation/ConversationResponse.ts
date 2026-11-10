import { ConversationType } from '../enums'

export interface ConversationResponse
{
    id: number;
    ownerUsername?: string;
    otherUsername?: string;
    conversationName: string;
    iconUrl?: string;
    conversationType: ConversationType;
    lastMessageID: number | null;
    unreadCount: number;
}