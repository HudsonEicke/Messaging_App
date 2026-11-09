import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import type { ConversationResponse } from '@/types';
import type { AppDispatch, RootState } from '@/store/store';
import { addMember, fetchMembers, leaveConversation, updateConversation } from '@/store/conversationSlice';
import type { ApiError } from '@/lib/utils';
import { getErrorMessage } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import StatusBadge from '@/components/user/StatusBadge';
import { GROUP_NAME_MAX_LENGTH, ICON_URL_MAX_LENGTH, USERNAME_MAX_LENGTH, addMemberSchema, groupDetailsSchema } from './GroupSettingsDialog.schema';
import type { AddMemberFormValues, GroupDetailsFormValues } from './GroupSettingsDialog.schema';

interface GroupSettingsDialogProps
{
    conversation: ConversationResponse;
    isActive: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const GroupSettingsDialog = ({ conversation, isActive, open, onOpenChange }: GroupSettingsDialogProps) =>
{
    const currentUsername = useSelector((state: RootState) => state.user.user?.username);
    const isOwner = currentUsername !== undefined && conversation.ownerUsername === currentUsername;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Group settings</DialogTitle>
                    <DialogDescription className="truncate">{conversation.conversationName}</DialogDescription>
                </DialogHeader>

                <GroupDetailsForm conversation={conversation} />
                <Separator />
                <GroupMembers conversation={conversation} isOwner={isOwner} />
                <Separator />
                <LeaveGroup conversation={conversation} isOwner={isOwner} isActive={isActive} />
            </DialogContent>
        </Dialog>
    );
};

// rename and icon are open to any member, matching the backend
const GroupDetailsForm = ({ conversation }: { conversation: ConversationResponse }) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting, isDirty }
    } = useForm<GroupDetailsFormValues>({
        resolver: zodResolver(groupDetailsSchema),
        defaultValues: { conversationName: conversation.conversationName, iconUrl: conversation.iconUrl ?? '' }
    });

    const submit = async (values: GroupDetailsFormValues) =>
    {
        setServerError(null);

        try
        {
            await dispatch(updateConversation({ id: conversation.id, request: values })).unwrap();
            reset(values);
        }
        catch (error)
        {
            setServerError(getErrorMessage(error, 'Could not save changes'));
        }
    };

    return (
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-3">
            <div className="grid gap-2">
                <Label htmlFor="group-name">Group name</Label>
                <Input id="group-name" autoComplete="off" maxLength={GROUP_NAME_MAX_LENGTH} aria-invalid={!!errors.conversationName} {...register('conversationName')} />
                {errors.conversationName && <p className="text-sm text-destructive">{errors.conversationName.message}</p>}
            </div>

            <div className="grid gap-2">
                <Label htmlFor="group-icon-url">Icon URL</Label>
                <Input id="group-icon-url" type="url" autoComplete="off" placeholder="https://..." maxLength={ICON_URL_MAX_LENGTH} aria-invalid={!!errors.iconUrl} {...register('iconUrl')} />
                {errors.iconUrl && <p className="text-sm text-destructive">{errors.iconUrl.message}</p>}
            </div>

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <Button type="submit" size="sm" className="self-end" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? 'Saving...' : 'Save changes'}
            </Button>
        </form>
    );
};

const getAddMemberErrorMessage = (error: ApiError): string =>
{
    if (error.status === 404)
    {
        return 'No user has that username';
    }

    return error.message || 'Could not add member';
};

const GroupMembers = ({ conversation, isOwner }: { conversation: ConversationResponse; isOwner: boolean }) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const members = useSelector((state: RootState) => state.conversation.membersByConversation[conversation.id]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [addError, setAddError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<AddMemberFormValues>({
        resolver: zodResolver(addMemberSchema),
        defaultValues: { username: '' }
    });

    useEffect(() =>
    {
        dispatch(fetchMembers(conversation.id))
            .unwrap()
            .catch(error => setLoadError(getErrorMessage(error, 'Could not load members')));
    }, [dispatch, conversation.id]);

    const submit = async (values: AddMemberFormValues) =>
    {
        setAddError(null);

        try
        {
            await dispatch(addMember({ conversationID: conversation.id, username: values.username.replace(/^@/, '') })).unwrap();
            reset();
        }
        catch (error)
        {
            setAddError(getAddMemberErrorMessage(error as ApiError));
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">
                Members{members !== undefined && <span className="text-muted-foreground"> · {members.length}</span>}
            </p>

            {
                members === undefined
                    ? <p className="text-sm text-muted-foreground">{loadError ?? 'Loading members...'}</p>
                    : (
                        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                            {
                                members.map(member => (
                                    <li key={member.username} className="flex items-center gap-2 py-1">
                                        <div className="relative">
                                            <Avatar className="size-7">
                                                <AvatarImage src={member.profileImageUrl} alt="" />
                                                <AvatarFallback><User className="size-3.5" aria-hidden="true" /></AvatarFallback>
                                            </Avatar>
                                            <StatusBadge status={member.activityStatus} className="size-3 bg-popover ring-popover" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm">{member.displayName}</p>
                                            <p className="truncate text-xs text-muted-foreground">{member.username}</p>
                                        </div>
                                        {member.username === conversation.ownerUsername && <span className="shrink-0 text-xs text-muted-foreground">Owner</span>}
                                    </li>
                                ))
                            }
                        </ul>
                    )
            }

            {
                isOwner && (
                    <form onSubmit={handleSubmit(submit)} noValidate className="grid gap-2">
                        <Label htmlFor="add-member-username">Add a member</Label>
                        <div className="flex gap-2">
                            <Input id="add-member-username" autoComplete="off" placeholder="Username" maxLength={USERNAME_MAX_LENGTH} aria-invalid={!!errors.username} {...register('username')} />
                            <Button type="submit" variant="outline" className="shrink-0" disabled={isSubmitting}>
                                {isSubmitting ? 'Adding...' : 'Add'}
                            </Button>
                        </div>
                        {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
                        {addError && <p className="text-sm text-destructive">{addError}</p>}
                    </form>
                )
            }
        </div>
    );
};

const LeaveGroup = ({ conversation, isOwner, isActive }: { conversation: ConversationResponse; isOwner: boolean; isActive: boolean }) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [leaveError, setLeaveError] = useState<string | null>(null);

    const handleConfirmOpenChange = (nextOpen: boolean) =>
    {
        setIsConfirmOpen(nextOpen);
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
            await dispatch(leaveConversation(conversation.id)).unwrap();

            if (isActive)
            {
                navigate('/channels/@me', { replace: true });
            }
        }
        catch (error)
        {
            setLeaveError(getErrorMessage(error, 'Could not leave group'));
            setIsLeaving(false);
        }
    };

    return (
        <>
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">You'll stop getting messages from this group.</p>
                <Button type="button" variant="destructive" size="sm" className="shrink-0" onClick={() => handleConfirmOpenChange(true)}>
                    Leave group
                </Button>
            </div>

            <AlertDialog open={isConfirmOpen} onOpenChange={handleConfirmOpenChange}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave {conversation.conversationName}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {
                                isOwner
                                    ? "You own this group. Ownership will pass to another member, or the group will be deleted if you're the only one left."
                                    : 'You can only come back if the owner adds you again.'
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {leaveError && <p className="text-sm text-destructive">{leaveError}</p>}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLeaving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" disabled={isLeaving} onClick={handleLeave}>
                            {isLeaving ? 'Leaving...' : 'Leave group'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default GroupSettingsDialog;
