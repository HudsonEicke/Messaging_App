import { NavLink } from 'react-router-dom';
import { Hash, Settings } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ChannelResponse } from '@/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ChannelItemProps
{
    serverId: number;
    channel: ChannelResponse;
    isActive: boolean;
    isOwner: boolean;
    onOpenSettings: (channelId: number) => void;
}

// one row in the channel list; ChannelList decides which one is active, from the URL
// owners can drag the row to reorder it and get a settings gear; for everyone else sorting is disabled
const ChannelItem = ({ serverId, channel, isActive, isOwner, onOpenSettings }: ChannelItemProps) =>
{
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: channel.channelID, disabled: !isOwner });

    return (
        <div
            ref={setNodeRef}
            // Translate rather than Transform, so rows of different heights aren't scaled while they swap
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={cn('group relative px-2', isDragging && 'z-10 opacity-80')}
        >
            <span
                aria-hidden="true"
                className={cn(
                    'absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r-full bg-foreground transition-all',
                    channel.hasUnread && !isActive ? 'h-2' : 'h-0'
                )}
            />

            <NavLink
                to={`/channels/${serverId}/${channel.channelID}`}
                aria-current={isActive ? 'page' : undefined}
                // only the instructions from attributes: its role="button" and tabIndex would hide that this is a link
                aria-describedby={isOwner ? attributes['aria-describedby'] : undefined}
                {...listeners}
                className={cn(
                    'flex h-8 items-center gap-1.5 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                    isOwner && 'pr-8',
                    isActive
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                        : cn(
                            'hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                            channel.hasUnread ? 'font-semibold text-sidebar-foreground' : 'text-muted-foreground'
                        )
                )}
            >
                <Hash className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{channel.channelName}</span>
            </NavLink>

            {
                // a sibling of the link, not inside it, since a button can't go inside an <a>
                isOwner && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                aria-label={`Settings for ${channel.channelName}`}
                                onClick={() => onOpenSettings(channel.channelID)}
                                className={cn(
                                    'absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground outline-none transition-opacity hover:text-sidebar-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover:opacity-100',
                                    isActive ? 'opacity-100' : 'opacity-0'
                                )}
                            >
                                <Settings className="size-4" aria-hidden="true" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Channel settings</TooltipContent>
                    </Tooltip>
                )
            }
        </div>
    );
};

export default ChannelItem;
