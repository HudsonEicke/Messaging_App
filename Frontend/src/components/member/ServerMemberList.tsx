import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store/store';
import { fetchServerMembers } from '@/store/serverSlice';
import { getErrorMessage } from '@/lib/utils';
import { useOnReconnect } from '@/hooks/useOnReconnect';
import MemberList from './MemberList';

interface ServerMemberListProps
{
    serverId: number;
    ownerUsername: string | undefined;
}

const ServerMemberList = ({ serverId, ownerUsername }: ServerMemberListProps) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const members = useSelector((state: RootState) => state.server.membersByServer[serverId]);
    const [loadError, setLoadError] = useState<string | null>(null);

    // refetched on every open since nothing pushes status changes until SignalR
    const fetchList = useCallback(() =>
    {
        dispatch(fetchServerMembers(serverId))
            .unwrap()
            .catch(error => setLoadError(getErrorMessage(error, 'Could not load members')));
    }, [dispatch, serverId]);

    useEffect(() =>
    {
        fetchList();
    }, [fetchList]);

    useOnReconnect(fetchList);

    const handleRetry = () =>
    {
        setLoadError(null);
        fetchList();
    };

    return <MemberList members={members} ownerUsername={ownerUsername} loadError={loadError} onRetry={handleRetry} />;
};

export default ServerMemberList;
