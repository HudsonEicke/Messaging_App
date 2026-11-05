import api from './api';
import { type UpdateMeRequest, type UpdatePasswordRequest, type UpdateStatusRequest, type UserDetailedResponse, type UserResponse } from '@/types';

export const getMe = async(): Promise<UserDetailedResponse> => {
    const { data } = await api.get<UserDetailedResponse>('/users/me');
    return data;
};

export const getUserById = async(id: number): Promise<UserResponse> => {
    const { data } = await api.get<UserResponse>(`/users/${id}`);
    return data;
};

export const getByUsername = async(username: string): Promise<UserResponse> => {
    const { data } = await api.get<UserResponse>(`/users/username/${username}`);
    return data;
};

export const updateMe = async(updateRequest: UpdateMeRequest): Promise<UserResponse> => {
    const { data } = await api.patch<UserResponse>('/users/me', updateRequest);
    return data;
};

export const updatePassword = async(updatePasswordRequest: UpdatePasswordRequest): Promise<void> => {
    await api.put('/users/me/password', updatePasswordRequest);
};

export const updateStatus = async(updateStatusRequest: UpdateStatusRequest): Promise<void> => {
    await api.put('/users/me/status', updateStatusRequest);
};
