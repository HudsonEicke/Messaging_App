import { NavLink } from 'react-router-dom';
import type { ServerResponse } from '@/types';
import { cn, getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ServerIconProps
{
    server: ServerResponse;
    isActive: boolean;
}

const ServerIcon = ({ server, isActive }: ServerIconProps) =>
{
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

            <Tooltip>
                <TooltipTrigger asChild>
                    <NavLink
                        to={`/channels/${server.serverID}`}
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
                </TooltipTrigger>
                <TooltipContent side="right">{server.serverName}</TooltipContent>
            </Tooltip>
        </div>
    );
};

export default ServerIcon;
