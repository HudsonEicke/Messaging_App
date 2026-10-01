import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import userReducer from './userSlice'
import conversationReducer from './conversationSlice'
import serverReducer from './serverSlice'
import channelReducer from './channelSlice'

export const store = configureStore({
    reducer: {
        auth: authReducer,
        user: userReducer,
        conversation: conversationReducer,
        server: serverReducer,
        channel: channelReducer
    }
});

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch