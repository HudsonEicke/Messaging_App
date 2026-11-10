import { useState } from 'react';
import { useDispatch } from 'react-redux';
import type { UserResponse } from '@/types';
import type { AppDispatch } from '@/store/store';
import { unblockUser } from '@/store/friendSlice';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// shown in place of the composer in a DM with someone you've blocked; the history stays readable
const BlockedNotice = ({ user }: { user: UserResponse }) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const [isUnblocking, setIsUnblocking] = useState(false);
    const [unblockError, setUnblockError] = useState<string | null>(null);

    const handleUnblock = async () =>
    {
        setIsUnblocking(true);
        setUnblockError(null);

        try
        {
            // the composer comes back on its own once they leave the blocked list
            await dispatch(unblockUser(user.username)).unwrap();
        }
        catch (error)
        {
            setUnblockError(getErrorMessage(error, 'Could not unblock user'));
            setIsUnblocking(false);
        }
    };

    return (
        <div className="shrink-0 px-4 pb-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 dark:bg-input/30">
                <p className="min-w-0 text-sm text-muted-foreground">
                    You've blocked <span className="font-medium text-foreground">{user.displayName}</span>, so you can't message them.
                </p>
                <Button variant="outline" size="sm" className="shrink-0" disabled={isUnblocking} onClick={handleUnblock}>
                    {isUnblocking ? 'Unblocking...' : 'Unblock'}
                </Button>
            </div>
            {unblockError && <p role="alert" className="mt-1 text-sm text-destructive">{unblockError}</p>}
        </div>
    );
};

export default BlockedNotice;
