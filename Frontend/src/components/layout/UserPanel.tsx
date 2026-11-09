import { useSelector } from 'react-redux';
import { LogOut } from 'lucide-react';
import type { RootState } from '@/store/store';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import StatusPicker from '@/components/user/StatusPicker';

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
            <StatusPicker user={user} />

            {logoutButton}
        </div>
    );
};

export default UserPanel;
