import { NavLink } from 'react-router-dom';
import { Hash } from 'lucide-react';
import type { ChannelResponse } from '@/types';
import { cn } from '@/lib/utils';

interface ChannelItemProps
{
    serverId: number;
    channel: ChannelResponse;
    isActive: boolean;
}

// one row in the channel list; ChannelList decides which one is active, from the URL
const ChannelItem = ({ serverId, channel, isActive }: ChannelItemProps) =>
{
    return (
        <div className="relative px-2">
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
                className={cn(
                    'flex h-8 items-center gap-1.5 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
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
        </div>
    );
};

export default ChannelItem;
