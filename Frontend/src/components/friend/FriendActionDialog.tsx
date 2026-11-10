import { useState } from 'react';
import type { MouseEvent } from 'react';
import { useDispatch } from 'react-redux';
import type { UserResponse } from '@/types';
import type { AppDispatch } from '@/store/store';
import { blockUser, removeFriend } from '@/store/friendSlice';
import { getErrorMessage } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export type FriendAction = 'remove' | 'block';

interface FriendActionDialogProps
{
    user: UserResponse;
    action: FriendAction;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const actionText: Record<FriendAction, { title: string; description: string; confirm: string; pending: string; fallbackError: string }> = {
    remove: {
        title: 'Remove friend?',
        description: 'They won\'t be told, and you can send them a new friend request later.',
        confirm: 'Remove friend',
        pending: 'Removing...',
        fallbackError: 'Could not remove friend'
    },
    block: {
        title: 'Block user?',
        description: 'This also removes them as a friend and cancels any friend requests between you. They won\'t be able to send you new ones.',
        confirm: 'Block',
        pending: 'Blocking...',
        fallbackError: 'Could not block user'
    }
};

const FriendActionDialog = ({ user, action, open, onOpenChange }: FriendActionDialogProps) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const [isWorking, setIsWorking] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const text = actionText[action];

    const handleOpenChange = (nextOpen: boolean) =>
    {
        onOpenChange(nextOpen);
        setActionError(null);
    };

    const handleConfirm = async (event: MouseEvent<HTMLButtonElement>) =>
    {
        // keep the alert open until the request finishes so an error can show
        event.preventDefault();
        setIsWorking(true);
        setActionError(null);

        try
        {
            if (action === 'remove')
            {
                await dispatch(removeFriend(user.username)).unwrap();
            }
            else
            {
                await dispatch(blockUser(user.username)).unwrap();
            }

            onOpenChange(false);
        }
        catch (error)
        {
            setActionError(getErrorMessage(error, text.fallbackError));
        }
        finally
        {
            setIsWorking(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{text.title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        <span className="font-medium text-foreground">{user.displayName}</span> ({user.username}). {text.description}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {actionError && <p className="text-sm text-destructive">{actionError}</p>}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isWorking}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" disabled={isWorking} onClick={handleConfirm}>
                        {isWorking ? text.pending : text.confirm}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default FriendActionDialog;
