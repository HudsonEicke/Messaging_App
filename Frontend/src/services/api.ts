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

let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string>
{
    if (!refreshPromise)
    {
        const { refreshToken, accessToken } = store.getState().auth;

        refreshPromise = api.post<AuthResponse>('/auth/refresh', {
            refreshToken,
            accessToken
        })
            .then(({ data }) => {
                store.dispatch(setTokens({
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken
                }));

                return data.accessToken;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const isAuthEndpoint = originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/register') || originalRequest.url?.includes('/auth/refresh');

        if(error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint)
        {
            originalRequest._retry = true;

            try
            {
                const currentToken = store.getState().auth.accessToken;
                const sentWithCurrentToken = originalRequest.headers.Authorization === `Bearer ${currentToken}`;

                const accessToken = currentToken && !sentWithCurrentToken
                    ? currentToken
                    : await refreshAccessToken();

                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
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