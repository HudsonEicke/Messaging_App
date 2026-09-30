import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import userReducer from './userSlice'
import conversationReducer from './conversationSlice'

export const store = configureStore({
    reducer: {
        auth: authReducer,
        user: userReducer,
        conversation: conversationReducer
    }
});

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch