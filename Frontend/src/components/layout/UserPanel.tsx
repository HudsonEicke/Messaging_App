import { useSelector } from 'react-redux';
import { LogOut, User } from 'lucide-react';
import type { RootState } from '@/store/store';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/user/StatusBadge';

const UserPanel = () =>
{
    const { user, status } = useSelector((state: RootState) => state.user);
    const { logout } = useAuth();

    const logoutButton = (
        <Button variant="ghost" size="icon" aria-label="Log out" onClick={logout}>
            <LogOut />
        </Button>
    );

    // same height as the loaded panel so the sidebar doesn't jump when the user arrives
    if (!user)
    {
        return (
            <div className="flex h-14 items-center gap-2 border-t px-2">
                <span className="flex-1 text-sm text-muted-foreground">
                    {status === 'failed' ? 'Could not load profile' : 'Loading…'}
                </span>
                {status === 'failed' && logoutButton}
            </div>
        );
    }

    return (
        <div className="flex h-14 items-center gap-2 border-t px-2">
            <Avatar>
                <AvatarImage src={user.profileImageUrl} alt={user.displayName} />
                <AvatarFallback><User/></AvatarFallback>
                <StatusBadge status={user.activityStatus} />
            </Avatar>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user.username}</p>
            </div>

            {logoutButton}
        </div>
    );
};

export default UserPanel;
