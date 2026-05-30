import axios from 'axios';
import { store } from '@/store/store';
import { setTokens, clearTokens } from '@/store/authSlice';
import type { AuthResponse } from '@/types';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
    const token = store.getState().auth.accessToken;

    if (token)
    {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if(error.response?.status === 401 && !originalRequest._retry)
        {
            originalRequest._retry = true;

            const state = store.getState();
            const refreshToken = state.auth.refreshToken;
            const accessToken = state.auth.accessToken;

            try
            {
                const { data } = await api.post<AuthResponse>('/auth/refresh', {
                    refreshToken,
                    accessToken
                });

                store.dispatch(setTokens({
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken
                }));

                originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                return api(originalRequest);
            }
            catch
            {
                store.dispatch(clearTokens());
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
});

export default api;