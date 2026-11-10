import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Trash2, User, UserMinus } from 'lucide-react';
import type { InviteResponse, ServerResponse, UserResponse } from '@/types';
import type { AppDispatch, RootState } from '@/store/store';
import { deleteInvite, deleteServer, fetchInvites, fetchServerMembers, updateServer } from '@/store/serverSlice';
import type { ApiError } from '@/lib/utils';
import { copyToClipboard, getErrorMessage, getInitials } from '@/lib/utils';
import { isWebUrl } from '@/lib/url';
import { byDisplayName } from '@/lib/userSort';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import KickMemberDialog from '@/components/member/KickMemberDialog';
import { SERVER_NAME_MAX_LENGTH } from './CreateServerForm.schema';
import { SERVER_ICON_URL_MAX_LENGTH, serverOverviewSchema } from './ServerSettingsDialog.schema';
import type { ServerOverviewFormValues } from './ServerSettingsDialog.schema';

const COPIED_RESET_MS = 2000;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const isInviteUsedUp = (invite: InviteResponse) => invite.maxUses !== null && invite.uses >= invite.maxUses;

// the backend also lists invites that have expired or run out of uses
const isInviteUsable = (invite: InviteResponse, now: number) =>
    (invite.expiresDate === null || new Date(invite.expiresDate).getTime() > now)
    && !isInviteUsedUp(invite);

const describeExpiry = (expiresDate: string | null, now: number): string =>
{
    if (expiresDate === null)
    {
        return 'Never expires';
    }

    const timeLeft = new Date(expiresDate).getTime() - now;

    if (timeLeft <= 0)
    {
        return 'Expired';
    }

    if (timeLeft < HOUR_MS)
    {
        return `Expires ${relativeTime.format(Math.ceil(timeLeft / MINUTE_MS), 'minute')}`;
    }

    if (timeLeft < DAY_MS)
    {
        return `Expires ${relativeTime.format(Math.ceil(timeLeft / HOUR_MS), 'hour')}`;
    }

    return `Expires ${relativeTime.format(Math.ceil(timeLeft / DAY_MS), 'day')}`;
};

const describeUses = (invite: InviteResponse) =>
    invite.maxUses === null ? `${invite.uses} ${invite.uses === 1 ? 'use' : 'uses'}` : `${invite.uses} / ${invite.maxUses} uses`;

interface ServerSettingsDialogProps
{
    server: ServerResponse;
    // deleting from the server rail can be for a server you're not looking at
    isActive: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// owner only; Leave and Invite people stay in the server menu, since every member has them
const ServerSettingsDialog = ({ server, isActive, open, onOpenChange }: ServerSettingsDialogProps) =>
{
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Server settings</DialogTitle>
                    <DialogDescription className="truncate">{server.serverName}</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="overview">
                    <TabsList className="w-full">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="invites">Invites</TabsTrigger>
                        <TabsTrigger value="members">Members</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview">
                        <OverviewTab server={server} isActive={isActive} onDeleted={() => onOpenChange(false)} />
                    </TabsContent>
                    {/* Radix only mounts the open tab, so each list loads when its tab is opened */}
                    <TabsContent value="invites">
                        <InvitesTab serverId={server.serverID} />
                    </TabsContent>
                    <TabsContent value="members">
                        <MembersTab server={server} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

const OverviewTab = ({ server, isActive, onDeleted }: { server: ServerResponse; isActive: boolean; onDeleted: () => void }) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const [serverError, setServerError] = useState<string | null>(null);
    const [savedMessage, setSavedMessage] = useState<string | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        setError,
        control,
        formState: { errors, isSubmitting, isDirty, dirtyFields }
    } = useForm<ServerOverviewFormValues>({
        resolver: zodResolver(serverOverviewSchema),
        defaultValues: { serverName: server.serverName, iconUrl: server.iconUrl }
    });

    const previewName = useWatch({ control, name: 'serverName' }).trim() || server.serverName;
    const previewIconUrl = useWatch({ control, name: 'iconUrl' }).trim();

    const submit = async (values: ServerOverviewFormValues) =>
    {
        setServerError(null);
        setSavedMessage(null);

        try
        {
            // PATCH leaves out fields you didn't touch
            const updated = await dispatch(updateServer({
                serverID: server.serverID,
                request: {
                    serverName: dirtyFields.serverName ? values.serverName : undefined,
                    iconUrl: dirtyFields.iconUrl ? values.iconUrl : undefined
                }
            })).unwrap();

            reset({ serverName: updated.serverName, iconUrl: updated.iconUrl });
            setSavedMessage('Changes saved.');
        }
        catch (error)
        {
            const fieldErrors = (error as ApiError).fieldErrors;
            const nameError = fieldErrors?.serverName?.[0];
            const iconError = fieldErrors?.iconUrl?.[0];

            if (nameError)
            {
                setError('serverName', { message: nameError });
            }

            if (iconError)
            {
                setError('iconUrl', { message: iconError });
            }

            if (!nameError && !iconError)
            {
                setServerError(getErrorMessage(error, 'Could not save changes'));
            }
        }
    };

    return (
        <div className="flex flex-col gap-4 pt-2">
            <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <Avatar className="size-16 rounded-2xl after:rounded-[inherit]">
                        <AvatarImage src={isWebUrl(previewIconUrl) ? previewIconUrl : undefined} alt="" className="rounded-[inherit]" />
                        <AvatarFallback className="rounded-[inherit] text-lg">{getInitials(previewName)}</AvatarFallback>
                    </Avatar>
                    <p className="min-w-0 truncate font-medium">{previewName}</p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="server-settings-name">Server name</Label>
                    <Input
                        id="server-settings-name"
                        autoComplete="off"
                        maxLength={SERVER_NAME_MAX_LENGTH}
                        aria-invalid={!!errors.serverName}
                        {...register('serverName')}
                    />
                    {errors.serverName && <p className="text-sm text-destructive">{errors.serverName.message}</p>}
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="server-settings-icon">Icon URL</Label>
                    <Input
                        id="server-settings-icon"
                        type="url"
                        autoComplete="off"
                        placeholder="https://..."
                        maxLength={SERVER_ICON_URL_MAX_LENGTH}
                        aria-invalid={!!errors.iconUrl}
                        aria-describedby="server-settings-icon-hint"
                        {...register('iconUrl')}
                    />
                    <p id="server-settings-icon-hint" className="text-xs text-muted-foreground">Leave blank to remove the icon.</p>
                    {errors.iconUrl && <p className="text-sm text-destructive">{errors.iconUrl.message}</p>}
                </div>

                {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
                {savedMessage && !isDirty && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{savedMessage}</p>}

                <Button type="submit" size="sm" className="self-end" disabled={isSubmitting || !isDirty}>
                    {isSubmitting ? 'Saving...' : 'Save changes'}
                </Button>
            </form>

            <Separator />

            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm font-medium">Delete server</p>
                    <p className="text-xs text-muted-foreground">Deletes every channel and message for everyone. This can't be undone.</p>
                </div>
                <Button variant="destructive" size="sm" className="shrink-0" onClick={() => setIsDeleteOpen(true)}>
                    <Trash2 aria-hidden="true" />
                    Delete
                </Button>
            </div>

            <DeleteServerAlert server={server} isActive={isActive} open={isDeleteOpen} onOpenChange={setIsDeleteOpen} onDeleted={onDeleted} />
        </div>
    );
};

interface DeleteServerAlertProps
{
    server: ServerResponse;
    isActive: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDeleted: () => void;
}

const DeleteServerAlert = ({ server, isActive, open, onOpenChange, onDeleted }: DeleteServerAlertProps) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleOpenChange = (nextOpen: boolean) =>
    {
        onOpenChange(nextOpen);
        setDeleteError(null);
    };

    const handleDelete = async (event: MouseEvent<HTMLButtonElement>) =>
    {
        // keep the alert open until the request finishes so an error can show
        event.preventDefault();
        setIsDeleting(true);
        setDeleteError(null);

        try
        {
            await dispatch(deleteServer(server.serverID)).unwrap();
            onDeleted();

            if (isActive)
            {
                navigate('/channels/@me', { replace: true });
            }
        }
        catch (error)
        {
            setDeleteError(getErrorMessage(error, 'Could not delete server'));
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete {server.serverName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Every channel and message in it will be deleted for all members. This can't be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" disabled={isDeleting} onClick={handleDelete}>
                        {isDeleting ? 'Deleting...' : 'Delete server'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

const InvitesTab = ({ serverId }: { serverId: number }) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const invites = useSelector((state: RootState) => state.server.invitesByServer[serverId]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [revokingCode, setRevokingCode] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    // fixed when the tab opens so rendering stays pure; reopening the tab refreshes it
    const [now] = useState(() => Date.now());

    // invites send no hub events, so the list is refetched every time the tab opens
    const requestInvites = useCallback(() =>
    {
        dispatch(fetchInvites(serverId))
            .unwrap()
            .catch(error => setLoadError(getErrorMessage(error, 'Could not load invites')));
    }, [dispatch, serverId]);

    useEffect(() =>
    {
        requestInvites();
    }, [requestInvites]);

    const retryInvites = () =>
    {
        setLoadError(null);
        requestInvites();
    };

    useEffect(() =>
    {
        if (copiedCode === null)
        {
            return;
        }

        const timeoutId = setTimeout(() => setCopiedCode(null), COPIED_RESET_MS);

        return () => clearTimeout(timeoutId);
    }, [copiedCode]);

    const copyCode = (code: string) =>
    {
        copyToClipboard(code);
        setCopiedCode(code);
    };

    const revoke = async (code: string) =>
    {
        setRevokingCode(code);
        setActionError(null);

        try
        {
            await dispatch(deleteInvite({ serverID: serverId, code })).unwrap();
        }
        catch (error)
        {
            setActionError(getErrorMessage(error, 'Could not revoke invite'));
        }
        finally
        {
            setRevokingCode(null);
        }
    };

    if (invites === undefined)
    {
        return loadError
            ? (
                <div className="flex flex-col items-start gap-2 pt-2">
                    <p className="text-sm text-muted-foreground">{loadError}</p>
                    <Button variant="outline" size="sm" onClick={retryInvites}>Retry</Button>
                </div>
            )
            : <p className="pt-2 text-sm text-muted-foreground">Loading invites...</p>;
    }

    if (invites.length === 0)
    {
        return <p className="pt-2 text-sm text-muted-foreground">No invites yet. Use Invite people in the server menu to make one.</p>;
    }

    // usable invites first, newest first within each group
    const sortedInvites = [...invites].sort((first, second) =>
        Number(isInviteUsable(second, now)) - Number(isInviteUsable(first, now))
        || new Date(second.createdDate).getTime() - new Date(first.createdDate).getTime());

    return (
        <div className="flex flex-col gap-2 pt-2">
            {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}

            <ScrollArea className="max-h-80 [&_[data-slot=scroll-area-viewport]>div]:block!">
                <ul className="flex flex-col">
                    {
                        sortedInvites.map(invite =>
                        {
                            const isUsable = isInviteUsable(invite, now);
                            const isCopied = copiedCode === invite.inviteCode;

                            return (
                                <li key={invite.inviteCode} className="flex items-center gap-2 border-t py-2 first:border-t-0">
                                    <div className={isUsable ? 'min-w-0 flex-1' : 'min-w-0 flex-1 opacity-60'}>
                                        <p className="truncate font-mono text-xs">{invite.inviteCode}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {invite.createdByUsername} · {describeUses(invite)} · {describeExpiry(invite.expiresDate, now)}
                                            {isInviteUsedUp(invite) && ' · Used up'}
                                        </p>
                                    </div>

                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon-sm" aria-label={isCopied ? 'Copied' : 'Copy code'} onClick={() => copyCode(invite.inviteCode)}>
                                                {isCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">{isCopied ? 'Copied' : 'Copy code'}</TooltipContent>
                                    </Tooltip>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={revokingCode === invite.inviteCode}
                                        onClick={() => revoke(invite.inviteCode)}
                                    >
                                        {revokingCode === invite.inviteCode ? 'Revoking...' : 'Revoke'}
                                    </Button>
                                </li>
                            );
                        })
                    }
                </ul>
            </ScrollArea>
        </div>
    );
};

const MembersTab = ({ server }: { server: ServerResponse }) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const members = useSelector((state: RootState) => state.server.membersByServer[server.serverID]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [kickTarget, setKickTarget] = useState<UserResponse | null>(null);

    // the cached list may be missing or stale, so it's fetched when the tab opens
    const requestMembers = useCallback(() =>
    {
        dispatch(fetchServerMembers(server.serverID))
            .unwrap()
            .catch(error => setLoadError(getErrorMessage(error, 'Could not load members')));
    }, [dispatch, server.serverID]);

    useEffect(() =>
    {
        requestMembers();
    }, [requestMembers]);

    const retryMembers = () =>
    {
        setLoadError(null);
        requestMembers();
    };

    if (members === undefined)
    {
        return loadError
            ? (
                <div className="flex flex-col items-start gap-2 pt-2">
                    <p className="text-sm text-muted-foreground">{loadError}</p>
                    <Button variant="outline" size="sm" onClick={retryMembers}>Retry</Button>
                </div>
            )
            : <p className="pt-2 text-sm text-muted-foreground">Loading members...</p>;
    }

    // you're the owner, and the owner can't be kicked
    const kickableMembers = members.filter(member => member.username !== server.ownerUsername).sort(byDisplayName);

    if (kickableMembers.length === 0)
    {
        return <p className="pt-2 text-sm text-muted-foreground">You're the only member so far.</p>;
    }

    return (
        <div className="pt-2">
            <ScrollArea className="max-h-80 [&_[data-slot=scroll-area-viewport]>div]:block!">
                <ul className="flex flex-col">
                    {
                        kickableMembers.map(member => (
                            <li key={member.username} className="flex items-center gap-3 border-t py-2 first:border-t-0">
                                <Avatar className="size-8 shrink-0">
                                    <AvatarImage src={member.profileImageUrl || undefined} alt="" />
                                    <AvatarFallback><User className="size-4" aria-hidden="true" /></AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{member.displayName}</p>
                                    <p className="truncate text-xs text-muted-foreground">{member.username}</p>
                                </div>
                                <Button variant="outline" size="sm" className="hover:text-destructive" onClick={() => setKickTarget(member)}>
                                    <UserMinus aria-hidden="true" />
                                    Kick
                                </Button>
                            </li>
                        ))
                    }
                </ul>
            </ScrollArea>

            {
                kickTarget && (
                    <KickMemberDialog
                        key={kickTarget.username}
                        serverId={server.serverID}
                        serverName={server.serverName}
                        member={kickTarget}
                        open
                        onOpenChange={open => { if (!open) setKickTarget(null); }}
                    />
                )
            }
        </div>
    );
};

export default ServerSettingsDialog;
