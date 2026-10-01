import type { CreateServerRequest, CreateServerResponse, ServerResponse, UpdateServerRequest, UserResponse, CreateChannelRequest, CreateChannelResponse, ChannelResponse, ReorderChannelRequest, CreateInviteRequest, CreateInviteResponse, InviteResponse } from "@/types";
import api from "./api";

export const createServer = async(request: CreateServerRequest): Promise<CreateServerResponse> => {
    const { data } = await api.post<CreateServerResponse>('/server/createserver', request);
    return data;
};

export const getServers = async(): Promise<ServerResponse[]> => {
    const { data } = await api.get<ServerResponse[]>('/server/servers');
    return data;
};

export const getServer = async(id: number): Promise<ServerResponse> => {
    const { data } = await api.get<ServerResponse>(`/server/${id}`);
    return data;
};

export const updateServer = async(id: number, request: UpdateServerRequest): Promise<void> => {
    await api.put(`/server/${id}`, request);
};

export const deleteServer = async(id: number): Promise<void> => {
    await api.delete(`/server/${id}`);
};

export const getServerMembers = async(id: number): Promise<UserResponse[]> => {
    const { data } = await api.get<UserResponse[]>(`/server/${id}/members`);
    return data;
};

export const leaveServer = async(id: number): Promise<void> => {
    await api.post(`/server/${id}/leave`);
};

export const kickMember = async(id: number, username: string): Promise<void> => {
    await api.delete(`/server/${id}/members/${username}`);
};

export const createChannel = async(id: number, request: CreateChannelRequest): Promise<CreateChannelResponse> => {
    const { data } = await api.post<CreateChannelResponse>(`/server/${id}/createchannel`, request);
    return data;
};

export const getChannels = async(id: number): Promise<ChannelResponse[]> => {
    const { data } = await api.get<ChannelResponse[]>(`/server/${id}/channels`);
    return data;
};

export const reorderChannels = async(id: number, request: ReorderChannelRequest): Promise<void> => {
    await api.put(`/server/${id}/channels/reorder`, request);
};

export const createInvite = async(id: number, request: CreateInviteRequest): Promise<CreateInviteResponse> => {
    const { data } = await api.post<CreateInviteResponse>(`/server/${id}/invite`, request);
    return data;
};

export const getInvites = async(id: number): Promise<InviteResponse[]> => {
    const { data } = await api.get<InviteResponse[]>(`/server/${id}/invites`);
    return data;
};

export const deleteInvite = async(id: number, code: string): Promise<void> => {
    await api.delete(`/server/${id}/invite/${code}`);
};

export const joinServer = async(code: string): Promise<ServerResponse> => {
    const { data } = await api.post<ServerResponse>(`/invite/${code}/join`);
    return data;
};