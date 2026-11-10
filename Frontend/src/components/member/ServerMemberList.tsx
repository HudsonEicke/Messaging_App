import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { UserResponse } from '@/types';
import type { AppDispatch, RootState } from '@/store/store';
import { fetchServerMembers } from '@/store/serverSlice';
import { getErrorMessage } from '@/lib/utils';
import { useOnReconnect } from '@/hooks/useOnReconnect';
import KickMemberDialog from './KickMemberDialog';
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
    const serverName = useSelector((state: RootState) => state.server.servers.find(server => server.serverID === serverId)?.serverName ?? '');
    const isCurrentUserOwner = useSelector((state: RootState) => state.user.user !== null && state.user.user.username === ownerUsername);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [kickTarget, setKickTarget] = useState<UserResponse | null>(null);

    // the hub keeps a cached list current, but not across a reconnect, so it's refetched on every open
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

    return (
        <>
            <MemberList members={members} ownerUsername={ownerUsername} loadError={loadError} onRetry={handleRetry} onKick={isCurrentUserOwner ? setKickTarget : undefined} />
            {
                kickTarget && (
                    <KickMemberDialog
                        key={kickTarget.username}
                        serverId={serverId}
                        serverName={serverName}
                        member={kickTarget}
                        open
                        onOpenChange={open => { if (!open) setKickTarget(null); }}
                    />
                )
            }
        </>
    );
};

export default ServerMemberList;
