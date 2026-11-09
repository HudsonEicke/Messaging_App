import { useEffect } from 'react';
import { startHub, stopHub } from '@/services/hub/connection';

// mounted by AppShell, so the connection lives exactly as long as you're logged in
export const useHubConnection = () =>
{
    useEffect(() =>
    {
        startHub();

        return stopHub;
    }, []);
};
