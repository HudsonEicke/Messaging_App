import type { ReactNode } from 'react';
import { User } from 'lucide-react';
import type { UserResponse } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import StatusBadge from '@/components/user/StatusBadge';

interface FriendRowProps
{
    user: UserResponse;
    subtitle: string;
    // status is only shown for friends
    showStatus: boolean;
    actions: ReactNode;
}

const FriendRow = ({ user, subtitle, showStatus, actions }: FriendRowProps) =>
{
    return (
        <li className="group flex items-center gap-3 rounded-md border-t px-2 py-2.5 first:border-t-0 hover:bg-accent/50">
            <Avatar className="size-8 shrink-0">
                <AvatarImage src={user.profileImageUrl || undefined} alt="" />
                <AvatarFallback><User className="size-4" aria-hidden="true" /></AvatarFallback>
                {showStatus && <StatusBadge status={user.activityStatus} className="bg-background ring-background" />}
            </Avatar>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>

            <div className="flex shrink-0 items-center gap-1">{actions}</div>
        </li>
    );
};

export default FriendRow;
