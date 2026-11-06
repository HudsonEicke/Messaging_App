import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store/store';
import { useActiveIds } from '@/hooks/useActiveIds';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchChannels, setLastChannel } from '@/store/serverSlice';
import ChannelItem from './ChannelItem';

const PLACEHOLDER_COUNT = 5;

interface ChannelListProps
{
    serverId: number;
}

// fills the sidebar when a server is open: a fixed header with the server name, then its channels
const ChannelList = ({ serverId }: ChannelListProps) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const server = useSelector((state: RootState) => state.server.servers.find(listedServer => listedServer.serverID === serverId));
    const channels = useSelector((state: RootState) => state.server.channelsByServer[serverId]);
    const channelsStatus = useSelector((state: RootState) => state.server.channelsStatusByServer[serverId] ?? 'idle');
    const channelsError = useSelector((state: RootState) => state.server.channelsErrorByServer[serverId] ?? null);
    const { channelId } = useActiveIds();

    useEffect(() =>
    {
        dispatch(fetchChannels(serverId));
    }, [dispatch, serverId]);

    // remember the open channel so coming back to this server returns to it; ServerIndexPage checks it still exists
    useEffect(() =>
    {
        if (channelId !== null)
        {
            dispatch(setLastChannel({ serverID: serverId, channelID: channelId }));
        }
    }, [dispatch, serverId, channelId]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center border-b px-4">
                <h2 className="truncate text-sm font-semibold">{server?.serverName}</h2>
            </header>

            <ScrollArea className="min-h-0 flex-1">
                <nav aria-label="Channels" className="flex flex-col gap-0.5 py-3">
                    {
                        // channels is undefined until this server's first fetch succeeds; after that a refetch keeps showing the cached list,
                        // so the loading and failed states only appear when there's nothing to show yet
                        channels === undefined
                            ? channelsStatus === 'failed'
                                ? (
                                    <div className="flex flex-col items-start gap-2 px-4">
                                        <p className="text-sm text-muted-foreground">{channelsError?.message ?? 'Could not load channels'}</p>
                                        <Button variant="outline" size="sm" onClick={() => dispatch(fetchChannels(serverId))}>
                                            Retry
                                        </Button>
                                    </div>
                                )
                                : Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
                                    // the placeholders never reorder, so the index is a safe key
                                    <div key={index} aria-hidden="true" className="mx-2 h-8 animate-pulse rounded-md bg-muted" />
                                ))
                            : channels.length === 0
                                ? <p className="px-4 text-sm text-muted-foreground">No channels yet</p>
                                : channels.map(channel => (
                                    <ChannelItem key={channel.channelID} serverId={serverId} channel={channel} isActive={channel.channelID === channelId} />
                                ))
                    }
                </nav>
            </ScrollArea>
        </div>
    );
};

export default ChannelList;
