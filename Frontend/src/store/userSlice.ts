import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { UserDetailedResponse } from '@/types';
import type { ApiError } from '@/lib/utils';
import { getApiError } from '@/lib/utils';
import { clearTokens } from './authSlice';
import { getMe } from '@/services/userService';

interface UserState
{
    user: UserDetailedResponse | null;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: ApiError | null;
}

const initialState: UserState = {
    user: null,
    status: 'idle',
    error: null
};

export const fetchMe = createAsyncThunk<UserDetailedResponse, void, { rejectValue: ApiError }>('user/fetchMe', async (_, { rejectWithValue }) => {
    try
    {
        return await getMe();
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not load your profile'));
    }
});

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<UserDetailedResponse>) => {
            state.user = action.payload;
        },
        clearUser: (state) => {
            state.user = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(clearTokens, () => initialState)
            .addCase(fetchMe.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(fetchMe.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.user = action.payload;
            })
            .addCase(fetchMe.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload ?? { message: 'Could not load your profile' };
            });
    }
});

export const { setUser, clearUser } = userSlice.actions;
export default userSlice.reducer;
