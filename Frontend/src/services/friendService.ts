import api from "./api";
import type { FriendRequestResponse, SendFriendRequestRequest, UserResponse } from "@/types";

export const getFriends = async(): Promise<UserResponse[]> => {
    const { data } = await api.get<UserResponse[]>('/friends');
    return data;
};

export const getPendingRequests = async(): Promise<UserResponse[]> => {
    const { data } = await api.get<UserResponse[]>('/friends/requests');
    return data;
};

export const getBlockedUsers = async(): Promise<UserResponse[]> => {
    const { data } = await api.get<UserResponse[]>('/friends/blocked');
    return data;
};

export const sendFriendRequest = async(username: string): Promise<FriendRequestResponse> => {
    const request: SendFriendRequestRequest = { username };
    const { data } = await api.post<FriendRequestResponse>('/friends/requests', request);
    return data;
};

export const acceptFriendRequest = async(username: string): Promise<UserResponse> => {
    const { data } = await api.post<UserResponse>(`/friends/requests/${username}/accept`);
    return data;
};

export const declineFriendRequest = async(username: string): Promise<void> => {
    await api.delete(`/friends/requests/${username}`);
};

export const removeFriend = async(username: string): Promise<void> => {
    await api.delete(`/friends/${username}`);
};

export const blockUser = async(username: string): Promise<void> => {
    await api.put(`/friends/blocked/${username}`);
};

export const unblockUser = async(username: string): Promise<void> => {
    await api.delete(`/friends/blocked/${username}`);
};
