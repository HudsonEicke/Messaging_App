import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import userReducer from './userSlice'
import conversationReducer from './conversationSlice'
import serverReducer from './serverSlice'
import channelReducer from './channelSlice'
import friendReducer from './friendSlice'
import hubReducer from './hubSlice'
import readingReducer from './readingSlice'
import { listenerMiddleware } from './listenerMiddleware';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        user: userReducer,
        conversation: conversationReducer,
        server: serverReducer,
        channel: channelReducer,
        friend: friendReducer,
        hub: hubReducer,
        reading: readingReducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listenerMiddleware.middleware)
});

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch