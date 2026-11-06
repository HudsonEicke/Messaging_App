import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from './store';
import { clearTokens } from './authSlice';
import { deleteServer, leaveServer, setLastChannel } from './serverSlice';
import { clearLastChannels, saveLastChannels } from '@/lib/lastChannelStorage';

export const listenerMiddleware = createListenerMiddleware();

const startAppListening = listenerMiddleware.startListening.withTypes<RootState, AppDispatch>();

startAppListening({
    matcher: isAnyOf(setLastChannel, deleteServer.fulfilled, leaveServer.fulfilled),
    effect: (_action, listenerApi) =>
    {
        saveLastChannels(listenerApi.getState().server.lastChannelByServer);
    }
});

startAppListening({
    actionCreator: clearTokens,
    effect: () =>
    {
        clearLastChannels();
    }
});
