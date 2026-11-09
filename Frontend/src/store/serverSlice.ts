import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ChannelResponse, CreateChannelRequest, CreateInviteRequest, CreateInviteResponse, CreateServerRequest, InviteResponse, ServerResponse, UpdateServerRequest, UserResponse } from '@/types';
import type { ApiError } from '@/lib/utils';
import { getApiError } from '@/lib/utils';
import { loadLastChannels } from '@/lib/lastChannelStorage';
import { clearTokens } from './authSlice';
import { updateChannel, deleteChannel, markChannelRead, sendMessage } from './channelSlice';
import { channelCreated, channelDeleted, channelMessageReceived, channelsReordered, channelUpdated, serverMemberJoined, serverMemberRemoved, serverOwnerChanged, serverRemoved, serverUpdated } from './hubEvents';
import { getServers, getServer, createServer as createServerRequest, updateServer as updateServerRequest, deleteServer as deleteServerRequest, leaveServer as leaveServerRequest, getServerMembers, kickMember as kickMemberRequest, getChannels, createChannel as createChannelRequest, reorderChannels as reorderChannelsRequest, getInvites, createInvite as createInviteRequest, deleteInvite as deleteInviteRequest, joinServer as joinServerRequest } from '@/services/serverService';

type FetchStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface ServerState
{
    servers: ServerResponse[];
    hasLoadedServers: boolean;
    channelsByServer: Record<number, ChannelResponse[]>;
    membersByServer: Record<number, UserResponse[]>;
    invitesByServer: Record<number, InviteResponse[]>;
    serversStatus: FetchStatus;
    serversError: ApiError | null;
    channelsStatusByServer: Record<number, FetchStatus>;
    channelsErrorByServer: Record<number, ApiError | null>;
    lastChannelByServer: Record<number, number>;
    error: ApiError | null;
}

const initialState: ServerState = {
    servers: [],
    hasLoadedServers: false,
    channelsByServer: {},
    membersByServer: {},
    invitesByServer: {},
    serversStatus: 'idle',
    serversError: null,
    channelsStatusByServer: {},
    channelsErrorByServer: {},
    lastChannelByServer: loadLastChannels(),
    error: null
};

// shared by deleteServer and leaveServer, both mean the server is gone for this user
const removeServer = (state: ServerState, serverID: number) => {
    state.servers = state.servers.filter(server => server.serverID !== serverID);
    delete state.channelsByServer[serverID];
    delete state.channelsStatusByServer[serverID];
    delete state.channelsErrorByServer[serverID];
    delete state.lastChannelByServer[serverID];
    delete state.membersByServer[serverID];
    delete state.invitesByServer[serverID];
};

// only the name and icon change, so the server keeps its unread dot
const applyServerUpdate = (state: ServerState, serverID: number, serverName: string, iconUrl: string) => {
    const server = state.servers.find(listedServer => listedServer.serverID === serverID);

    if (server)
    {
        server.serverName = serverName;
        server.iconUrl = iconUrl;
    }
};

const removeMember = (state: ServerState, serverID: number, username: string) => {
    const members = state.membersByServer[serverID];

    if (members)
    {
        state.membersByServer[serverID] = members.filter(member => member.username !== username);
    }
};

// reading a channel or sending in it clears its dot, and the server's dot once none of its channels are unread
const clearChannelUnread = (state: ServerState, channelID: number) => {
    for (const [serverID, channels] of Object.entries(state.channelsByServer))
    {
        const channel = channels.find(listedChannel => listedChannel.channelID === channelID);

        if (channel)
        {
            channel.hasUnread = false;

            const server = state.servers.find(listedServer => listedServer.serverID === Number(serverID));

            if (server)
            {
                server.hasUnread = channels.some(listedChannel => listedChannel.hasUnread);
            }

            return;
        }
    }
};

// the hub also delivers your own new channel, so it may already be listed; it has the last channelOrder, so the end keeps the list sorted
const addChannel = (state: ServerState, serverID: number, channel: ChannelResponse) => {
    const channels = state.channelsByServer[serverID];

    if (channels && !channels.some(listedChannel => listedChannel.channelID === channel.channelID))
    {
        channels.push(channel);
    }
};

// matches the backend, which sets channelOrder to each channel's index in channelIDs
const applyChannelOrder = (state: ServerState, serverID: number, channelIDs: number[]) => {
    const channels = state.channelsByServer[serverID];

    if (channels)
    {
        channels.forEach(channel => {
            channel.channelOrder = channelIDs.indexOf(channel.channelID);
        });

        channels.sort((a, b) => a.channelOrder - b.channelOrder);
    }
};

// ChannelUpdated and ChannelDeleted only carry the channel id, so these look through every loaded server
const findChannel = (state: ServerState, channelID: number) => {
    for (const channels of Object.values(state.channelsByServer))
    {
        const channel = channels.find(listedChannel => listedChannel.channelID === channelID);

        if (channel)
        {
            return channel;
        }
    }

    return undefined;
};

const removeChannel = (state: ServerState, channelID: number) => {
    for (const [serverID, channels] of Object.entries(state.channelsByServer))
    {
        if (channels.some(channel => channel.channelID === channelID))
        {
            // matches the backend, which renumbers channelOrder after a delete
            const remainingChannels = channels
                .filter(channel => channel.channelID !== channelID)
                .map((channel, index) => ({ ...channel, channelOrder: index }));

            state.channelsByServer[Number(serverID)] = remainingChannels;

            // deleting the only unread channel clears the server's dot
            const server = state.servers.find(listedServer => listedServer.serverID === Number(serverID));

            if (server)
            {
                server.hasUnread = remainingChannels.some(channel => channel.hasUnread);
            }
        }
    }

    // checked separately since the server's channels may not be loaded
    for (const [serverID, lastChannelID] of Object.entries(state.lastChannelByServer))
    {
        if (lastChannelID === channelID)
        {
            delete state.lastChannelByServer[Number(serverID)];
        }
    }
};

// the channel's dot only shows if its server's channels are loaded, the server's dot shows either way
const markChannelUnread = (state: ServerState, serverID: number, channelID: number) => {
    const channel = state.channelsByServer[serverID]?.find(listedChannel => listedChannel.channelID === channelID);
    const server = state.servers.find(listedServer => listedServer.serverID === serverID);

    if (channel)
    {
        channel.hasUnread = true;
    }

    if (server)
    {
        server.hasUnread = true;
    }
};

export const fetchServers = createAsyncThunk<ServerResponse[], void, { rejectValue: ApiError }>('server/fetchServers', async (_, { rejectWithValue }) => {
    try
    {
        return await getServers();
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not load servers'));
    }
});

export const createServer = createAsyncThunk<ServerResponse, CreateServerRequest, { rejectValue: ApiError }>('server/createServer', async (request, { rejectWithValue }) => {
    try
    {
        const result = await createServerRequest(request);

        // create only returns the id and name, so refetch to get the owner and icon
        return await getServer(result.serverID);
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not create server'));
    }
});

export const joinServer = createAsyncThunk<ServerResponse, string, { rejectValue: ApiError }>('server/joinServer', async (code, { rejectWithValue }) => {
    try
    {
        return await joinServerRequest(code);
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not join server'));
    }
});

export const updateServer = createAsyncThunk<ServerResponse, { serverID: number; request: UpdateServerRequest }, { rejectValue: ApiError }>('server/updateServer', async ({ serverID, request }, { rejectWithValue }) => {
    try
    {
        await updateServerRequest(serverID, request);

        // backend returns no body, so refetch to get the saved name and icon
        return await getServer(serverID);
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not update server'));
    }
});

export const deleteServer = createAsyncThunk<number, number, { rejectValue: ApiError }>('server/deleteServer', async (serverID, { rejectWithValue }) => {
    try
    {
        await deleteServerRequest(serverID);
        return serverID;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not delete server'));
    }
});

export const leaveServer = createAsyncThunk<number, number, { rejectValue: ApiError }>('server/leaveServer', async (serverID, { rejectWithValue }) => {
    try
    {
        await leaveServerRequest(serverID);
        return serverID;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not leave server'));
    }
});

export const fetchServerMembers = createAsyncThunk<{ serverID: number; members: UserResponse[] }, number, { rejectValue: ApiError }>('server/fetchServerMembers', async (serverID, { rejectWithValue }) => {
    try
    {
        const members = await getServerMembers(serverID);

        return {
            serverID,
            members
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not load members'));
    }
});

export const kickMember = createAsyncThunk<{ serverID: number; username: string }, { serverID: number; username: string }, { rejectValue: ApiError }>('server/kickMember', async (target, { rejectWithValue }) => {
    try
    {
        await kickMemberRequest(target.serverID, target.username);
        return target;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not kick member'));
    }
});

export const fetchChannels = createAsyncThunk<{ serverID: number; channels: ChannelResponse[] }, number, { rejectValue: ApiError }>('server/fetchChannels', async (serverID, { rejectWithValue }) => {
    try
    {
        const channels = await getChannels(serverID);

        return {
            serverID,
            channels
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not load channels'));
    }
});

export const createChannel = createAsyncThunk<{ serverID: number; channel: ChannelResponse }, { serverID: number; request: CreateChannelRequest }, { rejectValue: ApiError }>('server/createChannel', async ({ serverID, request }, { rejectWithValue }) => {
    try
    {
        const channel = await createChannelRequest(serverID, request);

        return {
            serverID,
            channel: { ...channel, hasUnread: false }
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not create channel'));
    }
});

export const reorderChannels = createAsyncThunk<{ serverID: number; channelIDs: number[] }, { serverID: number; channelIDs: number[] }, { rejectValue: ApiError }>('server/reorderChannels', async (reorder, { rejectWithValue }) => {
    try
    {
        // backend requires every channel id in the server, in the new order
        await reorderChannelsRequest(reorder.serverID, { channelIDs: reorder.channelIDs });
        return reorder;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not reorder channels'));
    }
});

export const fetchInvites = createAsyncThunk<{ serverID: number; invites: InviteResponse[] }, number, { rejectValue: ApiError }>('server/fetchInvites', async (serverID, { rejectWithValue }) => {
    try
    {
        const invites = await getInvites(serverID);

        return {
            serverID,
            invites
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not load invites'));
    }
});

export const createInvite = createAsyncThunk<{ serverID: number; invite: CreateInviteResponse }, { serverID: number; request: CreateInviteRequest }, { rejectValue: ApiError }>('server/createInvite', async ({ serverID, request }, { rejectWithValue }) => {
    try
    {
        const invite = await createInviteRequest(serverID, request);

        return {
            serverID,
            invite
        };
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not create invite'));
    }
});

export const deleteInvite = createAsyncThunk<{ serverID: number; code: string }, { serverID: number; code: string }, { rejectValue: ApiError }>('server/deleteInvite', async (target, { rejectWithValue }) => {
    try
    {
        await deleteInviteRequest(target.serverID, target.code);
        return target;
    }
    catch (error)
    {
        return rejectWithValue(getApiError(error, 'Could not delete invite'));
    }
});

const serverSlice = createSlice({
    name: 'server',
    initialState,
    reducers: {
        setLastChannel: (state, action: PayloadAction<{ serverID: number; channelID: number }>) => {
            state.lastChannelByServer[action.payload.serverID] = action.payload.channelID;
        }
    },
    extraReducers: (builder) => {
        builder
            // clearTokens fires on logout and when the token refresh fails, so reset everything
            // initialState holds the map loaded at startup, so empty it here or the old user's channels come back
            .addCase(clearTokens, () => ({ ...initialState, lastChannelByServer: {} }))
            .addCase(fetchServers.pending, (state) => {
                state.serversStatus = 'loading';
                state.serversError = null;
            })
            .addCase(fetchServers.fulfilled, (state, action) => {
                state.serversStatus = 'succeeded';
                state.hasLoadedServers = true;
                state.servers = action.payload;
            })
            .addCase(fetchServers.rejected, (state, action) => {
                state.serversStatus = 'failed';
                state.serversError = action.payload ?? { message: 'Could not load servers' };
            })
            .addCase(createServer.fulfilled, (state, action) => {
                state.servers.push(action.payload);
            })
            .addCase(createServer.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not create server' };
            })
            .addCase(joinServer.fulfilled, (state, action) => {
                state.servers.push(action.payload);
            })
            .addCase(joinServer.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not join server' };
            })
            .addCase(updateServer.fulfilled, (state, action) => {
                const { serverID, serverName, iconUrl } = action.payload;

                applyServerUpdate(state, serverID, serverName, iconUrl);
            })
            .addCase(updateServer.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not update server' };
            })
            .addCase(deleteServer.fulfilled, (state, action) => {
                removeServer(state, action.payload);
            })
            .addCase(deleteServer.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not delete server' };
            })
            .addCase(leaveServer.fulfilled, (state, action) => {
                removeServer(state, action.payload);
            })
            .addCase(leaveServer.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not leave server' };
            })
            .addCase(fetchServerMembers.fulfilled, (state, action) => {
                state.membersByServer[action.payload.serverID] = action.payload.members;
            })
            .addCase(fetchServerMembers.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not load members' };
            })
            .addCase(kickMember.fulfilled, (state, action) => {
                removeMember(state, action.payload.serverID, action.payload.username);
            })
            .addCase(kickMember.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not kick member' };
            })
            // keyed by server so a late response for one server can't change another's status; meta.arg is the serverID
            .addCase(fetchChannels.pending, (state, action) => {
                state.channelsStatusByServer[action.meta.arg] = 'loading';
                state.channelsErrorByServer[action.meta.arg] = null;
            })
            .addCase(fetchChannels.fulfilled, (state, action) => {
                state.channelsStatusByServer[action.payload.serverID] = 'succeeded';
                state.channelsByServer[action.payload.serverID] = action.payload.channels;
            })
            .addCase(fetchChannels.rejected, (state, action) => {
                state.channelsStatusByServer[action.meta.arg] = 'failed';
                state.channelsErrorByServer[action.meta.arg] = action.payload ?? { message: 'Could not load channels' };
            })
            .addCase(createChannel.fulfilled, (state, action) => {
                addChannel(state, action.payload.serverID, action.payload.channel);
            })
            .addCase(createChannel.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not create channel' };
            })
            // reorder straight away so a dropped channel doesn't jump back while the request runs; ChannelList refetches if it fails
            .addCase(reorderChannels.pending, (state, action) => {
                applyChannelOrder(state, action.meta.arg.serverID, action.meta.arg.channelIDs);
            })
            .addCase(reorderChannels.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not reorder channels' };
            })
            // updateChannel and deleteChannel are channelSlice thunks, but the channel list lives here
            .addCase(updateChannel.fulfilled, (state, action) => {
                const channel = findChannel(state, action.payload.channelID);

                if (channel)
                {
                    channel.channelName = action.payload.channelName;
                }
            })
            .addCase(markChannelRead.fulfilled, (state, action) => {
                clearChannelUnread(state, action.payload.channelID);
            })
            .addCase(sendMessage.fulfilled, (state, action) => {
                clearChannelUnread(state, action.payload.channelID);
            })
            // a message you sent from another tab is already read on the backend; if you're viewing
            // the channel, MessageList marks someone else's message read once the bottom is in view
            .addCase(channelMessageReceived, (state, action) => {
                const { serverID, channelID, isOwnMessage } = action.payload;

                if (isOwnMessage)
                {
                    clearChannelUnread(state, channelID);
                }
                else
                {
                    markChannelUnread(state, serverID, channelID);
                }
            })
            .addCase(deleteChannel.fulfilled, (state, action) => {
                removeChannel(state, action.payload.channelID);
            })
            .addCase(channelCreated, (state, action) => {
                addChannel(state, action.payload.serverID, action.payload.channel);
            })
            .addCase(channelUpdated, (state, action) => {
                const channel = findChannel(state, action.payload.channelID);

                if (channel)
                {
                    channel.channelName = action.payload.channelName;
                }
            })
            .addCase(channelsReordered, (state, action) => {
                applyChannelOrder(state, action.payload.serverID, action.payload.channelIDs);
            })
            .addCase(channelDeleted, (state, action) => {
                removeChannel(state, action.payload.channelID);
            })
            .addCase(serverMemberJoined, (state, action) => {
                const { serverID, member } = action.payload;
                const members = state.membersByServer[serverID];

                if (members && !members.some(listedMember => listedMember.username === member.username))
                {
                    members.push(member);
                }
            })
            .addCase(serverMemberRemoved, (state, action) => {
                removeMember(state, action.payload.serverID, action.payload.username);
            })
            .addCase(serverOwnerChanged, (state, action) => {
                const server = state.servers.find(listedServer => listedServer.serverID === action.payload.serverID);

                if (server)
                {
                    server.ownerUsername = action.payload.ownerUsername;
                }
            })
            .addCase(serverUpdated, (state, action) => {
                const { serverID, serverName, iconUrl } = action.payload;

                applyServerUpdate(state, serverID, serverName, iconUrl);
            })
            .addCase(serverRemoved, (state, action) => {
                removeServer(state, action.payload.serverID);
            })
            .addCase(fetchInvites.fulfilled, (state, action) => {
                state.invitesByServer[action.payload.serverID] = action.payload.invites;
            })
            .addCase(fetchInvites.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not load invites' };
            })
            // any member can create an invite but only the owner can list them, so drop the cached list instead of refetching it
            .addCase(createInvite.fulfilled, (state, action) => {
                delete state.invitesByServer[action.payload.serverID];
            })
            .addCase(createInvite.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not create invite' };
            })
            .addCase(deleteInvite.fulfilled, (state, action) => {
                const { serverID, code } = action.payload;
                const invites = state.invitesByServer[serverID];

                if (invites)
                {
                    state.invitesByServer[serverID] = invites.filter(invite => invite.inviteCode !== code);
                }
            })
            .addCase(deleteInvite.rejected, (state, action) => {
                state.error = action.payload ?? { message: 'Could not delete invite' };
            });
    }
});

export const { setLastChannel } = serverSlice.actions;

export default serverSlice.reducer;
