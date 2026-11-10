import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch } from '@/store/store';
import { createChannel } from '@/store/serverSlice';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ChannelNameForm from './ChannelNameForm';

interface CreateChannelDialogProps
{
    serverId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const CreateChannelDialog = ({ serverId, open, onOpenChange }: CreateChannelDialogProps) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();

    const handleCreate = async (channelName: string) =>
    {
        const { channel } = await dispatch(createChannel({ serverID: serverId, request: { channelName } })).unwrap();

        onOpenChange(false);
        navigate(`/channels/${serverId}/${channel.channelID}`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create channel</DialogTitle>
                    <DialogDescription>New channels are added to the bottom of the list.</DialogDescription>
                </DialogHeader>

                <ChannelNameForm submitLabel="Create channel" submittingLabel="Creating..." onSubmit={handleCreate} />
            </DialogContent>
        </Dialog>
    );
};

export default CreateChannelDialog;
