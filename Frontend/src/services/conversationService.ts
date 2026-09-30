import api from "./api";
import type { ConversationResult, CreateConversationRequest, CreateConversationResult, UpdateConversationRequest, MessageResponse, UserResponse, SendMessageRequest, SendMessageResponse, EditMessageRequest } from "@/types";

export const createConversation = async(request: CreateConversationRequest): Promise<CreateConversationResult> => {
    const { data } = await api.post<CreateConversationResult>('/conversation/createconversation', request);
    return data;
};

export const getConversations = async(): Promise<ConversationResult[]> => {
    const { data } = await api.get<ConversationResult[]>('/conversation/conversations');
    return data;
};

export const getConversation = async(id: number): Promise<ConversationResult> => {
    const { data } = await api.get<ConversationResult>(`/conversation/${id}`);
    return data;
};

export const updateConversation = async(id: number, request: UpdateConversationRequest): Promise<void> => {
    await api.put(`/conversation/${id}`, request);
};

export const getConversationMembers = async(id: number): Promise<UserResponse[]> => {
    const { data } = await api.get<UserResponse[]>(`/conversation/${id}/members`);
    return data;
};

export const addMember = async(id: number, username: string): Promise<UserResponse> => {
    const { data } = await api.post<UserResponse>(`/conversation/${id}/members/${username}`);
    return data;
};

export const leaveConversation = async(id: number): Promise<void> => {
    await api.post<void>(`/conversation/${id}/leave`);
};

export const getMessages = async(id: number, before?: number): Promise<MessageResponse[]> => {
    const { data } = await api.get<MessageResponse[]>(`/conversation/${id}/messages`, { params: { before }});
    return data;
};

export const sendMessage = async(id: number, request: SendMessageRequest): Promise<SendMessageResponse> => {
    const { data } = await api.post<SendMessageResponse>(`/conversation/${id}/sendmessage`, request);
    return data;
};

export const editMessage = async(messageId: number, request: EditMessageRequest): Promise<void> => {
    await api.put(`/conversationmessage/${messageId}`, request);
};

export const deleteMessage = async(messageId: number): Promise<void> => {
    await api.delete(`/conversationmessage/${messageId}`);
};