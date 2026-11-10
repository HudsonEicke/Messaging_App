import api from "./api";
import type { UpdateChannelRequest, MessageResponse, SendMessageRequest, SendMessageResponse, EditMessageRequest, UpdateReadStateRequest } from "@/types";

export const updateChannel = async(id: number, request: UpdateChannelRequest): Promise<void> => {
    await api.patch(`/channels/${id}`, request);
};

export const deleteChannel = async(id: number): Promise<void> => {
    await api.delete(`/channels/${id}`);
};

export const getMessages = async(id: number, before?: number): Promise<MessageResponse[]> => {
    const { data } = await api.get<MessageResponse[]>(`/channels/${id}/messages`, { params: { before }});
    return data;
};

export const sendMessage = async(id: number, request: SendMessageRequest): Promise<SendMessageResponse> => {
    const { data } = await api.post<SendMessageResponse>(`/channels/${id}/messages`, request);
    return data;
};

export const editMessage = async(messageId: number, request: EditMessageRequest): Promise<void> => {
    await api.patch(`/messages/${messageId}`, request);
};

export const deleteMessage = async(messageId: number): Promise<void> => {
    await api.delete(`/messages/${messageId}`);
};

export const markChannelRead = async(id: number, lastReadMessageID: number): Promise<void> => {
    const request: UpdateReadStateRequest = { lastReadMessageID };
    await api.put(`/channels/${id}/read-state`, request);
};
