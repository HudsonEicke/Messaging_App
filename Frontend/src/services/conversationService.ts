import api from "./api";
import type { ConversationResponse, CreateConversationRequest, CreateConversationResponse, UpdateConversationRequest, AddConversationMemberRequest, MessageResponse, UserResponse, SendMessageRequest, SendMessageResponse, EditMessageRequest } from "@/types";

export const createConversation = async(request: CreateConversationRequest): Promise<CreateConversationResponse> => {
    const { data } = await api.post<CreateConversationResponse>('/conversations', request);
    return data;
};

export const getConversations = async(): Promise<ConversationResponse[]> => {
    const { data } = await api.get<ConversationResponse[]>('/conversations');
    return data;
};

export const getConversation = async(id: number): Promise<ConversationResponse> => {
    const { data } = await api.get<ConversationResponse>(`/conversations/${id}`);
    return data;
};

export const updateConversation = async(id: number, request: UpdateConversationRequest): Promise<void> => {
    await api.patch(`/conversations/${id}`, request);
};

export const getConversationMembers = async(id: number): Promise<UserResponse[]> => {
    const { data } = await api.get<UserResponse[]>(`/conversations/${id}/members`);
    return data;
};

export const addMember = async(id: number, username: string): Promise<UserResponse> => {
    const request: AddConversationMemberRequest = { username };
    const { data } = await api.post<UserResponse>(`/conversations/${id}/members`, request);
    return data;
};

export const leaveConversation = async(id: number): Promise<void> => {
    await api.delete(`/conversations/${id}/members/me`);
};

export const getMessages = async(id: number, before?: number): Promise<MessageResponse[]> => {
    const { data } = await api.get<MessageResponse[]>(`/conversations/${id}/messages`, { params: { before }});
    return data;
};

export const sendMessage = async(id: number, request: SendMessageRequest): Promise<SendMessageResponse> => {
    const { data } = await api.post<SendMessageResponse>(`/conversations/${id}/messages`, request);
    return data;
};

export const editMessage = async(messageId: number, request: EditMessageRequest): Promise<void> => {
    await api.patch(`/conversation-messages/${messageId}`, request);
};

export const deleteMessage = async(messageId: number): Promise<void> => {
    await api.delete(`/conversation-messages/${messageId}`);
};