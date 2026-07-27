import { ConversationType } from "../enums";

export interface CreateConversationResult
{
    conversationID: number;
    conversationName: string;
    ownerUsername?: string;
    iconUrl?: string;
    conversationType: ConversationType;
    memberUsernames: string[];
}