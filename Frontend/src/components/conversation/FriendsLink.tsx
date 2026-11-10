import { useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { RootState } from '@/store/store';
import { cn } from '@/lib/utils';

const MAX_SHOWN_REQUESTS = 99;

// sits above the DM list; the badge counts friend requests waiting on you
const FriendsLink = () =>
{
    const incomingCount = useSelector((state: RootState) => state.friend.incomingRequests.length);

    return (
        <div className="px-2 pt-3">
            <NavLink
                to="/channels/@me"
                end
                className={({ isActive }) => cn(
                    'flex h-11 items-center gap-3 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                    isActive
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
            >
                <span className="flex size-8 shrink-0 items-center justify-center">
                    <Users className="size-5" aria-hidden="true" />
                </span>

                <span className="min-w-0 flex-1 truncate">Friends</span>

                {
                    incomingCount > 0 && (
                        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white">
                            {incomingCount > MAX_SHOWN_REQUESTS ? `${MAX_SHOWN_REQUESTS}+` : incomingCount}
                            <span className="sr-only"> pending friend requests</span>
                        </span>
                    )
                }
            </NavLink>
        </div>
    );
};

export default FriendsLink;
