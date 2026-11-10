import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { UserResponse } from '@/types';
import { FriendStatus } from '@/types';
import type { ApiError } from '@/lib/utils';
import { getApiError } from '@/lib/utils';
import { clearTokens } from './authSlice';
import { friendAdded, friendRemoved, friendRequestReceived, friendRequestSent, userBlocked, userStatusChanged, userUnblocked, userUpdated } from './hubEvents';
import { getFriends, getPendingRequests, getBlockedUsers, sendFriendRequest as sendFriendRequestRequest, acceptFriendRequest as acceptFriendRequestRequest, deleteFriendRequest as deleteFriendRequestRequest, removeFriend as removeFriendRequest, blockUser as blockUserRequest, unblockUser as unblockUserRequest } from '@/services/friendService';

type FetchStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface FriendState
{
    friends: UserResponse[];
    incomingRequests: UserResponse[];
    outgoingRequests: UserResponse[];
    blockedUsers: UserResponse[];
    // stays true through refetches so the lists don't flash back to a loading state
    hasLoaded: boolean;
    status: FetchStatus;
    error: ApiError | null;
}

const initialState: FriendState = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    blockedUsers: [],
    hasLoaded: false,
    status: 'idle',
    error: null
};

// a thunk's response and the matching hub event can arrive in either order, so adding twice is a no-op
const addUser = (users: UserResponse[], user: UserResponse) => {
    if (!users.some(listedUser => listedUser.username === user.username))
    {
        users.push(user);
    }
};

const withoutUser = (users: UserResponse[], username: string) => users.filter(listedUser => listedUser.username !== username);

// a friendship and a request in either direction can't exist together, so ending one clears all three lists
const removeRelationship = (state: FriendState, username: string) => {
    state.friends = withoutUser(state.friends, username);
    state.incomingRequests = withoutUser(state.incomingRequests, username);
    state.outgoingRequests = withoutUser(state.outgoingRequests, username);
};

const addFriend = (state: FriendState, user: UserResponse) => {
    removeRelationship(state, user.username);
    state.friends.push(user);
};

const blockListedUser = (state: FriendState, user: UserResponse) => {
    removeRelationship(state, user.username);
    addUser(state.blockedUsers, user);
};

const updateListedUser = (state: FriendState, username: string, update: (user: UserResponse) => void) => {
    for (const users of [state.friends, state.incomingRequests, state.outgoingRequests, state.blockedUsers])
    {
        const user = users.find(listedUser => listedUser.username === username);

        if (user)
        {
            update(user);
        }
    }
};

export const fetchFriendData = createAsyncThunk<{ friends: UserResponse[]; incomingRequests: UserResponse[]; outgoingRequests: UserResponse[]; blockedUsers: UserResponse[] }, void, { rejectValue: ApiError }>('friend/fetchFriendData', async (_, { rejectWithValue }) => {
    try
    {
        const [friends, incomingRequests, outgoingRequests, blockedUsers] = await Promise.all([
            getFriends(),
            getPendingRequests('incoming'),
            getPendingRequests('outgoing'),
            getBlockedUsers()
        ]);

        return { friends, incomingRequests, outgoingRequests, blockedUsers };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not load friends'));
    }
});

export const sendFriendRequest = createAsyncThunk<{ status: FriendStatus; user: UserResponse }, string, { rejectValue: ApiError }>('friend/sendFriendRequest', async (username, { rejectWithValue }) => {
    try
    {
        return await sendFriendRequestRequest(username);
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

// declines a request they sent, or cancels one you sent
export const deleteFriendRequest = createAsyncThunk<string, string, { rejectValue: ApiError }>('friend/deleteFriendRequest', async (username, { rejectWithValue }) => {
    try
    {
        await deleteFriendRequestRequest(username);
        return username;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not remove friend request'));
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
            .addCase(fetchFriendData.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(fetchFriendData.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.hasLoaded = true;
                state.friends = action.payload.friends;
                state.incomingRequests = action.payload.incomingRequests;
                state.outgoingRequests = action.payload.outgoingRequests;
                state.blockedUsers = action.payload.blockedUsers;
            })
            .addCase(fetchFriendData.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload ?? { message: 'Could not load friends' };
            })
            .addCase(sendFriendRequest.fulfilled, (state, action) => {
                const { status, user } = action.payload;

                // if they had already sent us a request, the backend accepts it instead
                if (status === FriendStatus.friends)
                {
                    addFriend(state, user);
                }
                else
                {
                    addUser(state.outgoingRequests, user);
                }
            })
            .addCase(acceptFriendRequest.fulfilled, (state, action) => {
                addFriend(state, action.payload);
            })
            .addCase(deleteFriendRequest.fulfilled, (state, action) => {
                removeRelationship(state, action.payload);
            })
            .addCase(removeFriend.fulfilled, (state, action) => {
                removeRelationship(state, action.payload);
            })
            .addCase(blockUser.fulfilled, (state, action) => {
                const { username, blockedUsers } = action.payload;

                // blocking removes any friendship or pending request in both directions
                removeRelationship(state, username);
                state.blockedUsers = blockedUsers;
            })
            .addCase(unblockUser.fulfilled, (state, action) => {
                // unblocking does not bring back an old friendship
                state.blockedUsers = withoutUser(state.blockedUsers, action.payload);
            })
            .addCase(friendRequestReceived, (state, action) => {
                addUser(state.incomingRequests, action.payload.user);
            })
            .addCase(friendRequestSent, (state, action) => {
                addUser(state.outgoingRequests, action.payload.user);
            })
            .addCase(friendAdded, (state, action) => {
                addFriend(state, action.payload.user);
            })
            .addCase(friendRemoved, (state, action) => {
                removeRelationship(state, action.payload.username);
            })
            .addCase(userBlocked, (state, action) => {
                blockListedUser(state, action.payload.user);
            })
            .addCase(userUnblocked, (state, action) => {
                state.blockedUsers = withoutUser(state.blockedUsers, action.payload.username);
            })
            .addCase(userStatusChanged, (state, action) => {
                updateListedUser(state, action.payload.username, user => { user.activityStatus = action.payload.status; });
            })
            .addCase(userUpdated, (state, action) => {
                const { username, displayName, profileImageUrl } = action.payload;

                updateListedUser(state, username, user => {
                    user.displayName = displayName;
                    user.profileImageUrl = profileImageUrl;
                });
            });
    }
});

export default friendSlice.reducer;
