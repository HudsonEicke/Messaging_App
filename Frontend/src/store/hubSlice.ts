import { createSlice } from '@reduxjs/toolkit';
import { clearTokens } from './authSlice';

export type HubStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface HubState
{
    status: HubStatus;
    reconnectCount: number;
}

const initialState: HubState = {
    status: 'disconnected',
    reconnectCount: 0
};

const hubSlice = createSlice({
    name: 'hub',
    initialState,
    reducers: {
        hubConnecting: (state) => {
            state.status = 'connecting';
        },
        hubConnected: (state) => {
            state.status = 'connected';
        },
        hubReconnecting: (state) => {
            state.status = 'reconnecting';
        },
        // events were missed while disconnected, so the count tells components to refetch
        hubReconnected: (state) => {
            state.status = 'connected';
            state.reconnectCount += 1;
        },
        hubDisconnected: (state) => {
            state.status = 'disconnected';
        }
    },
    extraReducers: (builder) => {
        builder.addCase(clearTokens, () => initialState);
    }
});

export const { hubConnecting, hubConnected, hubReconnecting, hubReconnected, hubDisconnected } = hubSlice.actions;
export default hubSlice.reducer;
