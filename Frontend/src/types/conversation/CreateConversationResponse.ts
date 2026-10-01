import { ConversationType } from "../enums";

export interface CreateConversationResponse
{
    conversationID: number;
    conversationName: string;
    ownerUsername?: string;
    iconUrl?: string;
    conversationType: ConversationType;
    memberUsernames: string[];
}