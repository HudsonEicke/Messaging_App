import { useState } from 'react';
import type { MouseEvent } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { ChannelResponse } from '@/types';
import type { AppDispatch } from '@/store/store';
import { deleteChannel, updateChannel } from '@/store/channelSlice';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ChannelNameForm from './ChannelNameForm';

interface ChannelSettingsDialogProps
{
    serverId: number;
    channel: ChannelResponse;
    isActive: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ChannelSettingsDialog = ({ serverId, channel, isActive, open, onOpenChange }: ChannelSettingsDialogProps) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleRename = async (channelName: string) =>
    {
        if (channelName !== channel.channelName)
        {
            await dispatch(updateChannel({ serverID: serverId, channelID: channel.channelID, channelName })).unwrap();
        }

        onOpenChange(false);
    };

    const handleConfirmOpenChange = (nextOpen: boolean) =>
    {
        setIsConfirmOpen(nextOpen);
        setDeleteError(null);
    };

    const handleDelete = async (event: MouseEvent<HTMLButtonElement>) =>
    {
        // AlertDialogAction closes the alert on click; keep it open until the request finishes so an error can show
        event.preventDefault();
        setIsDeleting(true);
        setDeleteError(null);

        try
        {
            await dispatch(deleteChannel({ serverID: serverId, channelID: channel.channelID })).unwrap();

            // the channel is gone from the list now, so ChannelList unmounts this dialog
            if (isActive)
            {
                navigate(`/channels/${serverId}`, { replace: true });
            }
        }
        catch (error)
        {
            setDeleteError(getErrorMessage(error, 'Could not delete channel'));
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Channel settings</DialogTitle>
                    <DialogDescription className="truncate">#{channel.channelName}</DialogDescription>
                </DialogHeader>

                <ChannelNameForm defaultName={channel.channelName} submitLabel="Save changes" submittingLabel="Saving..." onSubmit={handleRename}>
                    <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 p-3">
                        <p className="text-sm font-medium">Delete channel</p>
                        <p className="text-sm text-muted-foreground">This removes the channel and all of its messages for everyone. It can't be undone.</p>
                        <Button type="button" variant="destructive" size="sm" onClick={() => handleConfirmOpenChange(true)}>
                            Delete channel
                        </Button>
                    </div>
                </ChannelNameForm>

                <AlertDialog open={isConfirmOpen} onOpenChange={handleConfirmOpenChange}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete #{channel.channelName}?</AlertDialogTitle>
                            <AlertDialogDescription>All of its messages will be deleted for everyone. This can't be undone.</AlertDialogDescription>
                        </AlertDialogHeader>

                        {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" disabled={isDeleting} onClick={handleDelete}>
                                {isDeleting ? 'Deleting...' : 'Delete channel'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    );
};

export default ChannelSettingsDialog;
