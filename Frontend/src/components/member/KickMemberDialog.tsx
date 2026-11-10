import { useState } from 'react';
import type { MouseEvent } from 'react';
import { useDispatch } from 'react-redux';
import type { UserResponse } from '@/types';
import type { AppDispatch } from '@/store/store';
import { kickMember } from '@/store/serverSlice';
import { getErrorMessage } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface KickMemberDialogProps
{
    serverId: number;
    serverName: string;
    member: UserResponse;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const KickMemberDialog = ({ serverId, serverName, member, open, onOpenChange }: KickMemberDialogProps) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const [isKicking, setIsKicking] = useState(false);
    const [kickError, setKickError] = useState<string | null>(null);

    const handleOpenChange = (nextOpen: boolean) =>
    {
        onOpenChange(nextOpen);
        setKickError(null);
    };

    const handleKick = async (event: MouseEvent<HTMLButtonElement>) =>
    {
        // keep the alert open until the request finishes so an error can show
        event.preventDefault();
        setIsKicking(true);
        setKickError(null);

        try
        {
            await dispatch(kickMember({ serverID: serverId, username: member.username })).unwrap();
            onOpenChange(false);
        }
        catch (error)
        {
            setKickError(getErrorMessage(error, 'Could not kick member'));
            setIsKicking(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Kick {member.displayName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {member.username} will be removed from {serverName}. They can rejoin with a new invite.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {kickError && <p className="text-sm text-destructive">{kickError}</p>}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isKicking}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" disabled={isKicking} onClick={handleKick}>
                        {isKicking ? 'Kicking...' : 'Kick'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default KickMemberDialog;
