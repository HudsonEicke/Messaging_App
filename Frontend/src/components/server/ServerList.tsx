import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RotateCw } from 'lucide-react';
import type { AppDispatch, RootState } from '@/store/store';
import { useActiveIds } from '@/hooks/useActiveIds';
import { useOnReconnect } from '@/hooks/useOnReconnect';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fetchServers } from '@/store/serverSlice';
import AddServerButton from './AddServerButton';
import HomeButton from './HomeButton';
import InviteDialog from './InviteDialog';
import LeaveServerDialog from './LeaveServerDialog';
import ServerIcon from './ServerIcon';

const PLACEHOLDER_COUNT = 3;

const ServerList = () =>
{
    const dispatch = useDispatch<AppDispatch>();
    const { servers, hasLoadedServers, serversStatus, serversError } = useSelector((state: RootState) => state.server);
    const { serverId } = useActiveIds();
    const currentUsername = useSelector((state: RootState) => state.user.user?.username);
    const [menuTarget, setMenuTarget] = useState<{ serverId: number; action: 'invite' | 'leave' } | null>(null);
    const targetServer = servers.find(server => server.serverID === menuTarget?.serverId);

    const openInvite = (targetServerId: number) => setMenuTarget({ serverId: targetServerId, action: 'invite' });
    const openLeave = (targetServerId: number) => setMenuTarget({ serverId: targetServerId, action: 'leave' });
    const closeMenuDialog = (open: boolean) => { if (!open) setMenuTarget(null); };

    useEffect(() =>
    {
        dispatch(fetchServers());
    }, [dispatch]);

    useOnReconnect(() => dispatch(fetchServers()));

    return (
        <div className="flex flex-col items-center gap-2 py-3">
            <HomeButton isActive={serverId === null} />

            <Separator className="w-8" />

            {
                // once loaded, a refetch keeps showing the cached list, so placeholders and Retry only appear before that
                hasLoadedServers
                    ? servers.map(server => (
                        <ServerIcon key={server.serverID} server={server} isActive={server.serverID === serverId} onInvite={openInvite} onLeave={openLeave} />
                    ))
                    : serversStatus === 'failed'
                        ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        aria-label="Retry loading servers"
                                        className="size-10 rounded-full text-muted-foreground"
                                        onClick={() => dispatch(fetchServers())}
                                    >
                                        <RotateCw />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">{serversError?.message ?? 'Could not load servers'}</TooltipContent>
                            </Tooltip>
                        )
                        : Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
                            // the placeholders never reorder, so the index is a safe key
                            <div key={index} aria-hidden="true" className="size-10 animate-pulse rounded-full bg-muted" />
                        ))
            }

            <AddServerButton />

            {
                // dialogs for the right-click menu; a server that's been left disappears from the list and takes its dialog with it
                targetServer && menuTarget?.action === 'invite' && (
                    <InviteDialog serverId={targetServer.serverID} serverName={targetServer.serverName} open onOpenChange={closeMenuDialog} />
                )
            }
            {
                targetServer && menuTarget?.action === 'leave' && (
                    <LeaveServerDialog
                        server={targetServer}
                        isOwner={currentUsername !== undefined && targetServer.ownerUsername === currentUsername}
                        isActive={targetServer.serverID === serverId}
                        open
                        onOpenChange={closeMenuDialog}
                    />
                )
            }
        </div>
    );
};

export default ServerList;
