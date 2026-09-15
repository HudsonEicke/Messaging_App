import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const GuestRoute = () =>
{
    const { isAuthenticated } = useAuth();

    return isAuthenticated ? <Navigate to="/chat" /> : <Outlet />;
};

export default GuestRoute;
