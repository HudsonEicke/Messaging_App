import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RotateCw } from 'lucide-react';
import type { AppDispatch, RootState } from '@/store/store';
import { useActiveIds } from '@/hooks/useActiveIds';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fetchServers } from '@/store/serverSlice';
import HomeButton from './HomeButton';
import ServerIcon from './ServerIcon';

const PLACEHOLDER_COUNT = 3;

const ServerList = () =>
{
    const dispatch = useDispatch<AppDispatch>();
    const { servers, serversStatus, serversError } = useSelector((state: RootState) => state.server);
    const { serverId } = useActiveIds();

    useEffect(() =>
    {
        dispatch(fetchServers());
    }, [dispatch]);

    return (
        <div className="flex flex-col items-center gap-2 py-3">
            <HomeButton isActive={serverId === null} />

            <Separator className="w-8" />

            {
                // idle counts as loading so there's no empty frame before the effect's fetch starts
                serversStatus === 'idle' || serversStatus === 'loading'
                    ? Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
                        // the placeholders never reorder, so the index is a safe key
                        <div key={index} aria-hidden="true" className="size-10 animate-pulse rounded-full bg-muted" />
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
                        : servers.map(server => (
                            <ServerIcon key={server.serverID} server={server} isActive={server.serverID === serverId} />
                        ))
            }
        </div>
    );
};

export default ServerList;
