import { NavLink } from 'react-router-dom';
import { Link, LogOut, UserPlus } from 'lucide-react';
import type { ServerResponse } from '@/types';
import { cn, copyToClipboard, getAbsoluteUrl, getInitials } from '@/lib/utils';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ServerIconProps
{
    server: ServerResponse;
    isActive: boolean;
    onInvite: (serverId: number) => void;
    onLeave: (serverId: number) => void;
}

const ServerIcon = ({ server, isActive, onInvite, onLeave }: ServerIconProps) =>
{
    const serverPath = `/channels/${server.serverID}`;

    return (
        // group lets the pill and the avatar react to hovering anywhere on the row
        <div className="group relative flex w-full justify-center">
            <span
                aria-hidden="true"
                className={cn(
                    'absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r-full bg-foreground transition-all',
                    isActive
                        ? 'h-8'
                        : server.hasUnread
                            ? 'h-2 group-hover:h-4'
                            : 'h-0 group-hover:h-4'
                )}
            />

            {/* non-modal so the menu closing doesn't fight the dialog it opens for focus */}
            <ContextMenu modal={false}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <ContextMenuTrigger asChild>
                            <NavLink
                                to={serverPath}
                                aria-label={server.serverName}
                                // tells screen readers which server is open; NavLink's own aria-current only matches /channels/:serverId exactly
                                aria-current={isActive ? 'page' : undefined}
                                // same focus ring as the shadcn button, shaped like the hovered icon
                                className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                                <Avatar
                                    className={cn(
                                        'size-10 transition-all after:rounded-[inherit]',
                                        isActive ? 'rounded-xl' : 'rounded-[20px] group-hover:rounded-xl'
                                    )}
                                >
                                    <AvatarImage src={server.iconUrl} alt="" className="rounded-[inherit]" />
                                    <AvatarFallback className="rounded-[inherit]">{getInitials(server.serverName)}</AvatarFallback>
                                </Avatar>
                            </NavLink>
                        </ContextMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">{server.serverName}</TooltipContent>
                </Tooltip>

                <ContextMenuContent className="w-48">
                    <ContextMenuItem onSelect={() => onInvite(server.serverID)}>
                        <UserPlus aria-hidden="true" />
                        Invite people
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => copyToClipboard(getAbsoluteUrl(serverPath))}>
                        <Link aria-hidden="true" />
                        Copy link
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem variant="destructive" onSelect={() => onLeave(server.serverID)}>
                        <LogOut aria-hidden="true" />
                        Leave server
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </div>
    );
};

export default ServerIcon;
