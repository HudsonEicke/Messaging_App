import { useState } from 'react';
import { useSelector } from 'react-redux';
import { LogOut, Settings } from 'lucide-react';
import type { RootState } from '@/store/store';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import StatusPicker from '@/components/user/StatusPicker';
import UserSettingsDialog from '@/components/user/UserSettingsDialog';

const UserPanel = () =>
{
    const { user, status } = useSelector((state: RootState) => state.user);
    const { logout } = useAuth();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

            <Button variant="ghost" size="icon" aria-label="User settings" onClick={() => setIsSettingsOpen(true)}>
                <Settings />
            </Button>
            {logoutButton}

            {/* mounted only while open so the forms start from your current profile each time */}
            {isSettingsOpen && <UserSettingsDialog user={user} open onOpenChange={setIsSettingsOpen} />}
        </div>
    );
};

export default UserPanel;
