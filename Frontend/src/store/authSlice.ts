import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { login as loginRequest, register as registerRequest } from '@/services/authService';
import type { LoginRequest, RegisterRequest } from '@/types';

const getErrorMessage = (err: unknown, fallback: string): string => {
    if (axios.isAxiosError(err) && typeof err.response?.data?.message === 'string')
    {
        return err.response.data.message;
    }

    return fallback;
};

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

const persistTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

const clearPersistedTokens = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
};

interface AuthState
{
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

const initialState: AuthState = {
    accessToken: storedAccessToken,
    refreshToken: storedRefreshToken,
    isAuthenticated: !!storedRefreshToken,
    status: 'idle',
    error: null
};

export const login = createAsyncThunk<
    { accessToken: string; refreshToken: string },
    LoginRequest,
    { rejectValue: string }
>('auth/login', async (request, { rejectWithValue }) => {
    try
    {
        const { accessToken, refreshToken } = await loginRequest(request);
        return { accessToken, refreshToken };
    }
    catch (err)
    {
        return rejectWithValue(getErrorMessage(err, 'Invalid username or password'));
    }
});

export const register = createAsyncThunk<
    { accessToken: string; refreshToken: string },
    RegisterRequest,
    { rejectValue: string }
>('auth/register', async (request, { rejectWithValue }) => {
    try
    {
        const { accessToken, refreshToken } = await registerRequest(request);
        return { accessToken, refreshToken };
    }
    catch (err)
    {
        return rejectWithValue(getErrorMessage(err, 'Could not create account'));
    }
});

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setTokens: (state, action: PayloadAction<{ accessToken: string; refreshToken: string}>) => {
            state.accessToken = action.payload.accessToken;
            state.refreshToken = action.payload.refreshToken;
            state.isAuthenticated = true;
            persistTokens(action.payload.accessToken, action.payload.refreshToken);
        },
        clearTokens: (state) => {
            state.accessToken = null;
            state.refreshToken = null;
            state.isAuthenticated = false;
            clearPersistedTokens();
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(login.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(login.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.accessToken = action.payload.accessToken;
                state.refreshToken = action.payload.refreshToken;
                state.isAuthenticated = true;
                persistTokens(action.payload.accessToken, action.payload.refreshToken);
            })
            .addCase(login.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload ?? 'Login failed';
            })
            .addCase(register.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(register.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.accessToken = action.payload.accessToken;
                state.refreshToken = action.payload.refreshToken;
                state.isAuthenticated = true;
                persistTokens(action.payload.accessToken, action.payload.refreshToken);
            })
            .addCase(register.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload ?? 'Registration failed';
            });
    }
});

export const { setTokens, clearTokens } = authSlice.actions;
export default authSlice.reducer;
