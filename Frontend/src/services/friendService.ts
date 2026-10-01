import api from "./api";
import type { FriendRequestResponse, UserResponse } from "@/types";

export const getFriends = async(): Promise<UserResponse[]> => {
    const { data } = await api.get<UserResponse[]>('/friend');
    return data;
};

export const getPendingRequests = async(): Promise<UserResponse[]> => {
    const { data } = await api.get<UserResponse[]>('/friend/pending');
    return data;
};

export const getBlockedUsers = async(): Promise<UserResponse[]> => {
    const { data } = await api.get<UserResponse[]>('/friend/blocked');
    return data;
};

export const sendFriendRequest = async(username: string): Promise<FriendRequestResponse> => {
    const { data } = await api.post<FriendRequestResponse>(`/friend/request/${username}`);
    return data;
};

export const acceptFriendRequest = async(username: string): Promise<UserResponse> => {
    const { data } = await api.post<UserResponse>(`/friend/accept/${username}`);
    return data;
};

export const declineFriendRequest = async(username: string): Promise<void> => {
    await api.post(`/friend/decline/${username}`);
};

export const removeFriend = async(username: string): Promise<void> => {
    await api.delete(`/friend/${username}`);
};

export const blockUser = async(username: string): Promise<void> => {
    await api.post(`/friend/block/${username}`);
};

export const unblockUser = async(username: string): Promise<void> => {
    await api.delete(`/friend/block/${username}`);
};
