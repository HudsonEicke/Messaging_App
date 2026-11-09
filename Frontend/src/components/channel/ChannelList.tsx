import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { Announcements, DragEndEvent, Modifier, UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { AppDispatch, RootState } from '@/store/store';
import { useActiveIds } from '@/hooks/useActiveIds';
import { useSuppressClickAfterDrag } from '@/hooks/useSuppressClickAfterDrag';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchChannels, reorderChannels, setLastChannel } from '@/store/serverSlice';
import ServerHeader from '@/components/server/ServerHeader';
import ChannelItem from './ChannelItem';
import ChannelSettingsDialog from './ChannelSettingsDialog';
import CreateChannelDialog from './CreateChannelDialog';

const PLACEHOLDER_COUNT = 5;

// starting a drag needs 5px of movement, so a plain click still opens the channel
const POINTER_ACTIVATION = { distance: 5 };

// Enter is left out of start so it still follows the link; Space picks a channel up instead
const KEYBOARD_CODES = { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] };

const SCREEN_READER_INSTRUCTIONS = { draggable: 'To reorder this channel, press Space to pick it up, use the arrow keys to move it, then press Space to drop it or Escape to cancel.' };

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

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
    const currentUsername = useSelector((state: RootState) => state.user.user?.username);
    const { channelId } = useActiveIds();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [settingsTarget, setSettingsTarget] = useState<{ channelId: number; mode: 'settings' | 'delete' } | null>(null);
    const { startSuppressing, stopSuppressing } = useSuppressClickAfterDrag();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: POINTER_ACTIVATION }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES })
    );

    const isOwner = server !== undefined && currentUsername !== undefined && server.ownerUsername === currentUsername;
    const settingsChannel = channels?.find(channel => channel.channelID === settingsTarget?.channelId);

    const openChannelSettings = (channelId: number) => setSettingsTarget({ channelId, mode: 'settings' });
    const openChannelDelete = (channelId: number) => setSettingsTarget({ channelId, mode: 'delete' });

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

    const getChannelName = (id: UniqueIdentifier): string =>
    {
        return channels?.find(channel => channel.channelID === id)?.channelName ?? 'channel';
    };

    // the defaults announce raw ids, so read out channel names instead
    const announcements: Announcements = {
        onDragStart: ({ active }) => `Picked up ${getChannelName(active.id)}.`,
        onDragOver: ({ active, over }) => over ? `${getChannelName(active.id)} is over ${getChannelName(over.id)}.` : `${getChannelName(active.id)} is no longer over a channel.`,
        onDragEnd: ({ active, over }) => over ? `${getChannelName(active.id)} was dropped over ${getChannelName(over.id)}.` : `${getChannelName(active.id)} was dropped.`,
        onDragCancel: ({ active }) => `Moving ${getChannelName(active.id)} was cancelled.`
    };

    const handleDragEnd = ({ active, over }: DragEndEvent) =>
    {
        stopSuppressing();

        if (channels === undefined || over === null || active.id === over.id)
        {
            return;
        }

        const oldIndex = channels.findIndex(channel => channel.channelID === active.id);
        const newIndex = channels.findIndex(channel => channel.channelID === over.id);
        const channelIDs = arrayMove(channels, oldIndex, newIndex).map(channel => channel.channelID);

        // the slice reorders straight away, so on failure refetch to get the real order back
        dispatch(reorderChannels({ serverID: serverId, channelIDs }))
            .unwrap()
            .catch(() => dispatch(fetchChannels(serverId)));
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <ServerHeader server={server} isOwner={isOwner} onCreateChannel={() => setIsCreateOpen(true)} />

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
                                ? (
                                    <div className="flex flex-col items-start gap-2 px-4">
                                        <p className="text-sm text-muted-foreground">No channels yet</p>
                                        {
                                            isOwner && (
                                                <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                                                    <Plus aria-hidden="true" />
                                                    Create channel
                                                </Button>
                                            )
                                        }
                                    </div>
                                )
                                : (
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        modifiers={[restrictToVerticalAxis]}
                                        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
                                        onDragStart={startSuppressing}
                                        onDragEnd={handleDragEnd}
                                        onDragCancel={stopSuppressing}
                                    >
                                        <SortableContext items={channels.map(channel => channel.channelID)} strategy={verticalListSortingStrategy}>
                                            {
                                                channels.map(channel => (
                                                    <ChannelItem
                                                        key={channel.channelID}
                                                        serverId={serverId}
                                                        channel={channel}
                                                        isActive={channel.channelID === channelId}
                                                        isOwner={isOwner}
                                                        onOpenSettings={openChannelSettings}
                                                        onDelete={openChannelDelete}
                                                    />
                                                ))
                                            }
                                        </SortableContext>
                                    </DndContext>
                                )
                    }
                </nav>
            </ScrollArea>

            {
                isOwner && (
                    <>
                        <CreateChannelDialog serverId={serverId} open={isCreateOpen} onOpenChange={setIsCreateOpen} />
                        {
                            // rendered only while a channel is picked, and it disappears with the channel once deleted
                            settingsChannel && settingsTarget && (
                                <ChannelSettingsDialog
                                    // remount when switching between settings and delete so the confirm starts in the right state
                                    key={`${settingsTarget.channelId}-${settingsTarget.mode}`}
                                    serverId={serverId}
                                    channel={settingsChannel}
                                    isActive={settingsChannel.channelID === channelId}
                                    mode={settingsTarget.mode}
                                    open
                                    onOpenChange={open => { if (!open) setSettingsTarget(null); }}
                                />
                            )
                        }
                    </>
                )
            }
        </div>
    );
};

export default ChannelList;
