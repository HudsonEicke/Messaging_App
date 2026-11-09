import { useState } from 'react';
import type { MouseEvent } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { ServerResponse } from '@/types';
import type { AppDispatch } from '@/store/store';
import { leaveServer } from '@/store/serverSlice';
import { getErrorMessage } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface LeaveServerDialogProps
{
    server: ServerResponse;
    isOwner: boolean;
    // leaving from the server rail can be for a server you're not looking at
    isActive?: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const LeaveServerDialog = ({ server, isOwner, isActive = true, open, onOpenChange }: LeaveServerDialogProps) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const [isLeaving, setIsLeaving] = useState(false);
    const [leaveError, setLeaveError] = useState<string | null>(null);

    const handleOpenChange = (nextOpen: boolean) =>
    {
        onOpenChange(nextOpen);
        setLeaveError(null);
    };

    const handleLeave = async (event: MouseEvent<HTMLButtonElement>) =>
    {
        // keep the alert open until the request finishes so an error can show
        event.preventDefault();
        setIsLeaving(true);
        setLeaveError(null);

        try
        {
            await dispatch(leaveServer(server.serverID)).unwrap();

            if (isActive)
            {
                navigate('/channels/@me', { replace: true });
            }
        }
        catch (error)
        {
            setLeaveError(getErrorMessage(error, 'Could not leave server'));
            setIsLeaving(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Leave {server.serverName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {
                            isOwner
                                ? "You own this server. Ownership will pass to another member, or the server will be deleted if you're the only member."
                                : "You won't be able to rejoin unless someone sends you a new invite."
                        }
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {leaveError && <p className="text-sm text-destructive">{leaveError}</p>}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLeaving}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" disabled={isLeaving} onClick={handleLeave}>
                        {isLeaving ? 'Leaving...' : 'Leave server'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default LeaveServerDialog;
