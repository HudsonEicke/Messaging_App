import axios from 'axios';
import { store } from '@/store/store';
import { setTokens, clearTokens } from '@/store/authSlice';
import type { AuthResponse } from '@/types';
import { isTokenExpiring } from '@/lib/jwt';

const TOKEN_REFRESH_MARGIN_MS = 30_000;

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

// for the SignalR hub, which can't use the axios retry-on-401
export async function getFreshAccessToken(): Promise<string>
{
    const { accessToken } = store.getState().auth;

    if (accessToken && !isTokenExpiring(accessToken, TOKEN_REFRESH_MARGIN_MS))
    {
        return accessToken;
    }

    try
    {
        return await refreshAccessToken();
    }
    catch (error)
    {
        // only a refused refresh ends the session; a network error is left for the hub's next retry
        if (axios.isAxiosError(error) && error.response?.status === 401)
        {
            store.dispatch(clearTokens());
        }

        throw error;
    }
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