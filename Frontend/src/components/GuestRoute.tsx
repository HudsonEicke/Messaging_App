import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const GuestRoute = () =>
{
    const { isAuthenticated } = useAuth();

    return isAuthenticated ? <Navigate to="/channels/@me" /> : <Outlet />;
};

export default GuestRoute;
