import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { UserResponse } from '@/types';
import { FriendStatus } from '@/types';
import type { ApiError } from '@/lib/utils';
import { getApiError } from '@/lib/utils';
import { clearTokens } from './authSlice';
import { getByUsername } from '@/services/userService';
import { getFriends, getPendingRequests, getBlockedUsers, sendFriendRequest as sendFriendRequestRequest, acceptFriendRequest as acceptFriendRequestRequest, declineFriendRequest as declineFriendRequestRequest, removeFriend as removeFriendRequest, blockUser as blockUserRequest, unblockUser as unblockUserRequest } from '@/services/friendService';

interface FriendState
{
    friends: UserResponse[];
    pendingRequests: UserResponse[];
    blockedUsers: UserResponse[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: ApiError | null;
}

const initialState: FriendState = {
    friends: [],
    pendingRequests: [],
    blockedUsers: [],
    status: 'idle',
    error: null
};

export const fetchFriends = createAsyncThunk<UserResponse[], void, { rejectValue: ApiError }>('friend/fetchFriends', async (_, { rejectWithValue }) => {
    try
    {
        return await getFriends();
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not load friends'));
    }
});

export const fetchPendingRequests = createAsyncThunk<UserResponse[], void, { rejectValue: ApiError }>('friend/fetchPendingRequests', async (_, { rejectWithValue }) => {
    try
    {
        return await getPendingRequests();
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not load friend requests'));
    }
});

export const fetchBlockedUsers = createAsyncThunk<UserResponse[], void, { rejectValue: ApiError }>('friend/fetchBlockedUsers', async (_, { rejectWithValue }) => {
    try
    {
        return await getBlockedUsers();
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not load blocked users'));
    }
});

export const sendFriendRequest = createAsyncThunk<{ username: string; status: FriendStatus; friend?: UserResponse }, string, { rejectValue: ApiError }>('friend/sendFriendRequest', async (username, { rejectWithValue }) => {
    try
    {
        const { status } = await sendFriendRequestRequest(username);

        // if they had already sent us a request, the backend auto accepts, so grab the user to add to friends
        if (status === FriendStatus.friends)
        {
            const friend = await getByUsername(username);

            return {
                username,
                status,
                friend
            };
        }

        return {
            username,
            status
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not send friend request'));
    }
});

export const acceptFriendRequest = createAsyncThunk<UserResponse, string, { rejectValue: ApiError }>('friend/acceptFriendRequest', async (username, { rejectWithValue }) => {
    try
    {
        return await acceptFriendRequestRequest(username);
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not accept friend request'));
    }
});

export const declineFriendRequest = createAsyncThunk<string, string, { rejectValue: ApiError }>('friend/declineFriendRequest', async (username, { rejectWithValue }) => {
    try
    {
        await declineFriendRequestRequest(username);
        return username;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not decline friend request'));
    }
});

export const removeFriend = createAsyncThunk<string, string, { rejectValue: ApiError }>('friend/removeFriend', async (username, { rejectWithValue }) => {
    try
    {
        await removeFriendRequest(username);
        return username;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not remove friend'));
    }
});

export const blockUser = createAsyncThunk<{ username: string; blockedUsers: UserResponse[] }, string, { rejectValue: ApiError }>('friend/blockUser', async (username, { rejectWithValue }) => {
    try
    {
        await blockUserRequest(username);

        // backend returns no body, so refetch to get the blocked user's info
        const blockedUsers = await getBlockedUsers();

        return {
            username,
            blockedUsers
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not block user'));
    }
});

export const unblockUser = createAsyncThunk<string, string, { rejectValue: ApiError }>('friend/unblockUser', async (username, { rejectWithValue }) => {
    try
    {
        await unblockUserRequest(username);
        return username;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not unblock user'));
    }
});

const friendSlice = createSlice({
    name: 'friend',
    initialState,
    reducers: {

    },
    extraReducers: (builder) => {
        builder
            // clearTokens fires on logout and when the token refresh fails, so reset everything
            .addCase(clearTokens, () => initialState)
            .addCase(fetchFriends.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(fetchFriends.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.friends = action.payload;
            })
            .addCase(fetchFriends.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload ?? { message: 'Could not load friends' };
            })
            .addCase(fetchPendingRequests.fulfilled, (state, action) => {
                state.pendingRequests = action.payload;
            })
            .addCase(fetchPendingRequests.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not load friend requests' };
            })
            .addCase(fetchBlockedUsers.fulfilled, (state, action) => {
                state.blockedUsers = action.payload;
            })
            .addCase(fetchBlockedUsers.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not load blocked users' };
            })
            .addCase(sendFriendRequest.fulfilled, (state, action) => {
                const { username, friend } = action.payload;

                // a plain pending request has nothing to store, since the backend has no list of sent requests
                if (friend)
                {
                    state.pendingRequests = state.pendingRequests.filter(user => user.username !== username);
                    state.friends.push(friend);
                }
            })
            .addCase(sendFriendRequest.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not send friend request' };
            })
            .addCase(acceptFriendRequest.fulfilled, (state, action) => {
                state.pendingRequests = state.pendingRequests.filter(user => user.username !== action.payload.username);
                state.friends.push(action.payload);
            })
            .addCase(acceptFriendRequest.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not accept friend request' };
            })
            .addCase(declineFriendRequest.fulfilled, (state, action) => {
                state.pendingRequests = state.pendingRequests.filter(user => user.username !== action.payload);
            })
            .addCase(declineFriendRequest.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not decline friend request' };
            })
            .addCase(removeFriend.fulfilled, (state, action) => {
                state.friends = state.friends.filter(user => user.username !== action.payload);
            })
            .addCase(removeFriend.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not remove friend' };
            })
            .addCase(blockUser.fulfilled, (state, action) => {
                const { username, blockedUsers } = action.payload;

                // blocking removes any friendship or pending request in both directions
                state.friends = state.friends.filter(user => user.username !== username);
                state.pendingRequests = state.pendingRequests.filter(user => user.username !== username);
                state.blockedUsers = blockedUsers;
            })
            .addCase(blockUser.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not block user' };
            })
            .addCase(unblockUser.fulfilled, (state, action) => {
                // unblocking does not bring back an old friendship
                state.blockedUsers = state.blockedUsers.filter(user => user.username !== action.payload);
            })
            .addCase(unblockUser.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not unblock user' };
            });
    }
});

export default friendSlice.reducer;
