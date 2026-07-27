import { ConversationType } from '../enums'

export interface ConversationResult
{
    id: number;
    ownerUsername?: string;
    conversationName: string;
    iconUrl: string;
    conversationType: ConversationType;
}