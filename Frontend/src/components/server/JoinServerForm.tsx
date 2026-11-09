import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { InvitePreviewResponse } from '@/types';
import type { AppDispatch, RootState } from '@/store/store';
import { joinServer } from '@/store/serverSlice';
import { getInvitePreview } from '@/services/serverService';
import { getApiError, getErrorMessage, getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { joinServerSchema } from './JoinServerForm.schema';
import type { JoinServerFormValues } from './JoinServerForm.schema';

interface JoinServerFormProps
{
    onDone: () => void;
}

// two steps: look the code up and show which server it's for, then join
const JoinServerForm = ({ onDone }: JoinServerFormProps) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const [preview, setPreview] = useState<{ code: string; server: InvitePreviewResponse } | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const isAlreadyMember = useSelector((state: RootState) => preview !== null && state.server.servers.some(server => server.serverID === preview.server.serverID));

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting }
    } = useForm<JoinServerFormValues>({
        resolver: zodResolver(joinServerSchema),
        defaultValues: { inviteCode: '' }
    });

    const onLookUp = async (values: JoinServerFormValues) =>
    {
        setServerError(null);

        try
        {
            const server = await getInvitePreview(values.inviteCode);
            setPreview({ code: values.inviteCode, server });
        }
        catch (error)
        {
            const apiError = getApiError(error, 'Could not look up that invite');

            // NotFound() only carries the generic "Not Found" title
            setServerError(apiError.status === 404 ? "That invite doesn't exist" : apiError.message);
        }
    };

    const goToServer = (serverID: number) =>
    {
        onDone();
        navigate(`/channels/${serverID}`);
    };

    const handleJoin = async () =>
    {
        if (preview === null)
        {
            return;
        }

        setIsJoining(true);
        setServerError(null);

        try
        {
            const server = await dispatch(joinServer(preview.code)).unwrap();
            goToServer(server.serverID);
        }
        catch (error)
        {
            setServerError(getErrorMessage(error, 'Could not join server'));
            setIsJoining(false);
        }
    };

    if (preview !== null)
    {
        const { server } = preview;

        return (
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                    <Avatar className="size-12 rounded-xl after:rounded-[inherit]">
                        <AvatarImage src={server.iconUrl} alt="" className="rounded-[inherit]" />
                        <AvatarFallback className="rounded-[inherit]">{getInitials(server.serverName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="truncate font-semibold">{server.serverName}</p>
                        <p className="truncate text-sm text-muted-foreground">
                            {server.memberCount} {server.memberCount === 1 ? 'member' : 'members'} · Owned by {server.ownerUsername}
                        </p>
                    </div>
                </div>

                {isAlreadyMember && <p className="text-sm text-muted-foreground">You're already in this server.</p>}
                {serverError && <p className="text-sm text-destructive">{serverError}</p>}

                <DialogFooter>
                    <Button type="button" variant="outline" disabled={isJoining} onClick={() => { setPreview(null); setServerError(null); }}>
                        Back
                    </Button>
                    {
                        isAlreadyMember
                            ? <Button type="button" onClick={() => goToServer(server.serverID)}>Go to server</Button>
                            : (
                                <Button type="button" disabled={isJoining} onClick={handleJoin}>
                                    {isJoining ? 'Joining...' : 'Join server'}
                                </Button>
                            )
                    }
                </DialogFooter>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit(onLookUp)} noValidate className="flex flex-col gap-4">
            <div className="grid gap-2">
                <Label htmlFor="invite-code-input">Invite code</Label>
                <Input
                    id="invite-code-input"
                    autoComplete="off"
                    placeholder="e.g. 3f2b8c1e-7d4a-4e5b-9c6d-1a2b3c4d5e6f"
                    aria-invalid={!!errors.inviteCode}
                    {...register('inviteCode')}
                />
                {errors.inviteCode && <p className="text-sm text-destructive">{errors.inviteCode.message}</p>}
                {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            </div>

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Looking up...' : 'Continue'}
                </Button>
            </DialogFooter>
        </form>
    );
};

export default JoinServerForm;
