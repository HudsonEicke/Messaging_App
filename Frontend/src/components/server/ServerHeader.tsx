import { useState } from 'react';
import { ChevronDown, LogOut, Plus, Settings, UserPlus } from 'lucide-react';
import type { ServerResponse } from '@/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import InviteDialog from './InviteDialog';
import LeaveServerDialog from './LeaveServerDialog';
import ServerSettingsDialog from './ServerSettingsDialog';

interface ServerHeaderProps
{
    server: ServerResponse | undefined;
    isOwner: boolean;
    onCreateChannel: () => void;
}

// the top of the channel list: the server name, opening the server menu
const ServerHeader = ({ server, isOwner, onCreateChannel }: ServerHeaderProps) =>
{
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [isLeaveOpen, setIsLeaveOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    if (server === undefined)
    {
        return <header className="h-12 shrink-0 border-b" />;
    }

    return (
        <header className="flex h-12 shrink-0 border-b">
            <h2 className="flex min-w-0 flex-1 text-sm font-semibold">
                {/* non-modal so the menu closing doesn't fight the dialog it opens for focus and pointer events */}
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="group flex min-w-0 flex-1 items-center justify-between gap-2 px-4 text-left outline-none transition-colors hover:bg-sidebar-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset data-[state=open]:bg-sidebar-accent/50"
                        >
                            <span className="truncate">{server.serverName}</span>
                            <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setIsInviteOpen(true)}>
                            <UserPlus aria-hidden="true" />
                            Invite people
                        </DropdownMenuItem>
                        {
                            isOwner && (
                                <>
                                    <DropdownMenuItem onSelect={onCreateChannel}>
                                        <Plus aria-hidden="true" />
                                        Create channel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setIsSettingsOpen(true)}>
                                        <Settings aria-hidden="true" />
                                        Server settings
                                    </DropdownMenuItem>
                                </>
                            )
                        }
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setIsLeaveOpen(true)}>
                            <LogOut aria-hidden="true" />
                            Leave server
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </h2>

            <InviteDialog serverId={server.serverID} serverName={server.serverName} open={isInviteOpen} onOpenChange={setIsInviteOpen} />
            <LeaveServerDialog server={server} isOwner={isOwner} open={isLeaveOpen} onOpenChange={setIsLeaveOpen} />
            {/* mounted only while open so the form starts from the current name and icon each time */}
            {isOwner && isSettingsOpen && <ServerSettingsDialog server={server} isActive open onOpenChange={setIsSettingsOpen} />}
        </header>
    );
};

export default ServerHeader;
