import { ConversationType } from '../enums'

export interface ConversationResponse
{
    id: number;
    ownerUsername?: string;
    conversationName: string;
    iconUrl?: string;
    conversationType: ConversationType;
}