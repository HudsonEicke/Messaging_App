import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store/store';
import { login as loginThunk, register as registerThunk, clearTokens } from '@/store/authSlice';
import type { LoginRequest, RegisterRequest } from '@/types';

export const useAuth = () =>
{
    const dispatch = useDispatch<AppDispatch>();
    const { isAuthenticated, status, error } = useSelector((state: RootState) => state.auth);

    const login = useCallback(
        (credentials: LoginRequest) => dispatch(loginThunk(credentials)).unwrap(),
        [dispatch]
    );

    const register = useCallback(
        (details: RegisterRequest) => dispatch(registerThunk(details)).unwrap(),
        [dispatch]
    );

    const logout = useCallback(() => {
        dispatch(clearTokens());
    }, [dispatch]);

    return { login, register, logout, isAuthenticated, status, error };
};
