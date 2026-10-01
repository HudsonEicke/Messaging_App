import api from "./api";
import type { UpdateChannelRequest, MessageResponse, SendMessageRequest, SendMessageResponse, EditMessageRequest } from "@/types";

export const updateChannel = async(id: number, request: UpdateChannelRequest): Promise<void> => {
    await api.put(`/channel/${id}`, request);
};

export const deleteChannel = async(id: number): Promise<void> => {
    await api.delete(`/channel/${id}`);
};

export const getMessages = async(id: number, before?: number): Promise<MessageResponse[]> => {
    const { data } = await api.get<MessageResponse[]>(`/channel/${id}/messages`, { params: { before }});
    return data;
};

export const sendMessage = async(id: number, request: SendMessageRequest): Promise<SendMessageResponse> => {
    const { data } = await api.post<SendMessageResponse>(`/channel/${id}/sendmessage`, request);
    return data;
};

export const editMessage = async(messageId: number, request: EditMessageRequest): Promise<void> => {
    await api.put(`/message/${messageId}`, request);
};

export const deleteMessage = async(messageId: number): Promise<void> => {
    await api.delete(`/message/${messageId}`);
};
