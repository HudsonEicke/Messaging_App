import api from "./api";
import type { LoginRequest, RegisterRequest, AuthResponse, RefreshRequest, LogoutRequest } from "@/types";

export const login = async(request: LoginRequest): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', request);
    return data;
};

export const register = async(request: RegisterRequest): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/register', request);
    return data;
};

export const logout = async(request: LogoutRequest): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/logout', request);
    return data;
};

export const refresh = async(request: RefreshRequest): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/refresh', request);
    return data;
};