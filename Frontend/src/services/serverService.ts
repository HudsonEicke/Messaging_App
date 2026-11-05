import type { CreateServerRequest, CreateServerResponse, ServerResponse, UpdateServerRequest, UserResponse, CreateChannelRequest, CreateChannelResponse, ChannelResponse, ReorderChannelRequest, CreateInviteRequest, CreateInviteResponse, InviteResponse } from "@/types";
import api from "./api";

export const createServer = async(request: CreateServerRequest): Promise<CreateServerResponse> => {
    const { data } = await api.post<CreateServerResponse>('/servers', request);
    return data;
};

export const getServers = async(): Promise<ServerResponse[]> => {
    const { data } = await api.get<ServerResponse[]>('/servers');
    return data;
};

export const getServer = async(id: number): Promise<ServerResponse> => {
    const { data } = await api.get<ServerResponse>(`/servers/${id}`);
    return data;
};

export const updateServer = async(id: number, request: UpdateServerRequest): Promise<void> => {
    await api.patch(`/servers/${id}`, request);
};

export const deleteServer = async(id: number): Promise<void> => {
    await api.delete(`/servers/${id}`);
};

export const getServerMembers = async(id: number): Promise<UserResponse[]> => {
    const { data } = await api.get<UserResponse[]>(`/servers/${id}/members`);
    return data;
};

export const leaveServer = async(id: number): Promise<void> => {
    await api.delete(`/servers/${id}/members/me`);
};

export const kickMember = async(id: number, username: string): Promise<void> => {
    await api.delete(`/servers/${id}/members/${username}`);
};

export const createChannel = async(id: number, request: CreateChannelRequest): Promise<CreateChannelResponse> => {
    const { data } = await api.post<CreateChannelResponse>(`/servers/${id}/channels`, request);
    return data;
};

export const getChannels = async(id: number): Promise<ChannelResponse[]> => {
    const { data } = await api.get<ChannelResponse[]>(`/servers/${id}/channels`);
    return data;
};

export const reorderChannels = async(id: number, request: ReorderChannelRequest): Promise<void> => {
    await api.put(`/servers/${id}/channels/order`, request);
};

export const createInvite = async(id: number, request: CreateInviteRequest): Promise<CreateInviteResponse> => {
    const { data } = await api.post<CreateInviteResponse>(`/servers/${id}/invites`, request);
    return data;
};

export const getInvites = async(id: number): Promise<InviteResponse[]> => {
    const { data } = await api.get<InviteResponse[]>(`/servers/${id}/invites`);
    return data;
};

export const deleteInvite = async(id: number, code: string): Promise<void> => {
    await api.delete(`/servers/${id}/invites/${code}`);
};

export const joinServer = async(code: string): Promise<ServerResponse> => {
    const { data } = await api.post<ServerResponse>(`/invites/${code}/join`);
    return data;
};