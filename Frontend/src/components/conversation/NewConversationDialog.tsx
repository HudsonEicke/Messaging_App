import { useState } from 'react';
import type { KeyboardEvent, SubmitEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import type { AppDispatch, RootState } from '@/store/store';
import { createConversation, fetchConversations } from '@/store/conversationSlice';
import type { ApiError } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GROUP_NAME_MAX_LENGTH, MAX_OTHER_MEMBERS, USERNAME_MAX_LENGTH, newConversationSchema } from './NewConversationDialog.schema';
import type { NewConversationFormValues } from './NewConversationDialog.schema';

const SEPARATOR_PATTERN = /[\s,]+/;

interface NewConversationDialogProps
{
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const NewConversationDialog = ({ open, onOpenChange }: NewConversationDialogProps) =>
{
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New message</DialogTitle>
                    <DialogDescription>Add one person for a direct message, or more for a group.</DialogDescription>
                </DialogHeader>

                <NewConversationForm onDone={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
};

const getCreateErrorMessage = (error: ApiError): string =>
{
    if (error.status === 404)
    {
        return "One or more of those usernames don't exist";
    }

    if (error.status === 403)
    {
        return "You can't start a conversation with yourself";
    }

    return error.message || 'Could not start the conversation';
};

const NewConversationForm = ({ onDone }: { onDone: () => void }) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const currentUsername = useSelector((state: RootState) => state.user.user?.username);
    const [draft, setDraft] = useState('');
    const [chipError, setChipError] = useState<string | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        control,
        formState: { errors, isSubmitting }
    } = useForm<NewConversationFormValues>({
        resolver: zodResolver(newConversationSchema),
        defaultValues: { usernames: [], groupName: '' }
    });

    const usernames = useWatch({ control, name: 'usernames' });
    const isGroup = usernames.length > 1;

    const setUsernames = (nextUsernames: string[]) =>
    {
        setValue('usernames', nextUsernames, { shouldValidate: errors.usernames !== undefined });
    };

    // turns whatever is typed into chips; returns false if something was rejected so the text stays for fixing
    const commitDraft = (): boolean =>
    {
        const entries = draft.split(SEPARATOR_PATTERN).map(entry => entry.replace(/^@/, '')).filter(entry => entry !== '');
        const nextUsernames = [...usernames];
        let rejection: string | null = null;

        for (const entry of entries)
        {
            if (entry === currentUsername)
            {
                rejection = "You don't need to add yourself";
            }
            else if (entry.length > USERNAME_MAX_LENGTH)
            {
                rejection = `Usernames are ${USERNAME_MAX_LENGTH} characters or fewer`;
            }
            else if (nextUsernames.length >= MAX_OTHER_MEMBERS)
            {
                rejection = `You can add up to ${MAX_OTHER_MEMBERS} people`;
            }
            else if (!nextUsernames.includes(entry))
            {
                nextUsernames.push(entry);
            }
        }

        setUsernames(nextUsernames);
        setChipError(rejection);

        if (rejection === null)
        {
            setDraft('');
        }

        return rejection === null;
    };

    const handleDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) =>
    {
        if (event.key === 'Enter' || event.key === ',')
        {
            event.preventDefault();
            commitDraft();
        }
        else if (event.key === 'Backspace' && draft === '' && usernames.length > 0)
        {
            setUsernames(usernames.slice(0, -1));
        }
    };

    const submit = async (values: NewConversationFormValues) =>
    {
        setServerError(null);

        try
        {
            const conversation = await dispatch(createConversation({
                memberUsernames: values.usernames,
                conversationName: values.usernames.length > 1 && values.groupName !== '' ? values.groupName : undefined
            })).unwrap();

            // create doesn't return lastMessageID or unreadCount, and a reopened DM may have messages
            dispatch(fetchConversations());
            onDone();
            navigate(`/channels/@me/${conversation.id}`);
        }
        catch (error)
        {
            setServerError(getCreateErrorMessage(error as ApiError));
        }
    };

    const handleFormSubmit = (event: SubmitEvent<HTMLFormElement>) =>
    {
        // pick up a username that was typed but not turned into a chip yet
        if (draft.trim() !== '' && !commitDraft())
        {
            event.preventDefault();
            return;
        }

        handleSubmit(submit)(event);
    };

    return (
        <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-4">
            <div className="grid gap-2">
                <Label htmlFor="new-conversation-usernames">To</Label>
                <div
                    className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input px-1.5 py-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
                    aria-invalid={!!errors.usernames}
                >
                    {
                        usernames.map(username => (
                            <span key={username} className="flex h-6 items-center gap-1 rounded-md bg-secondary pr-1 pl-2 text-xs font-medium text-secondary-foreground">
                                {username}
                                <button
                                    type="button"
                                    aria-label={`Remove ${username}`}
                                    onClick={() => setUsernames(usernames.filter(listedUsername => listedUsername !== username))}
                                    className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                                >
                                    <X className="size-3" aria-hidden="true" />
                                </button>
                            </span>
                        ))
                    }
                    <input
                        id="new-conversation-usernames"
                        autoComplete="off"
                        value={draft}
                        placeholder={usernames.length === 0 ? 'Type a username and press Enter' : ''}
                        onChange={event => setDraft(event.target.value)}
                        onKeyDown={handleDraftKeyDown}
                        onBlur={() => { if (draft.trim() !== '') commitDraft(); }}
                        className="h-6 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                    />
                </div>
                {chipError && <p className="text-sm text-destructive">{chipError}</p>}
                {errors.usernames && <p className="text-sm text-destructive">{errors.usernames.message}</p>}
            </div>

            {
                isGroup && (
                    <div className="grid gap-2">
                        <Label htmlFor="new-conversation-group-name">Group name (optional)</Label>
                        <Input
                            id="new-conversation-group-name"
                            autoComplete="off"
                            maxLength={GROUP_NAME_MAX_LENGTH}
                            placeholder="Leave blank to use everyone's names"
                            aria-invalid={!!errors.groupName}
                            {...register('groupName')}
                        />
                        {errors.groupName && <p className="text-sm text-destructive">{errors.groupName.message}</p>}
                    </div>
                )
            }

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Starting...' : isGroup ? 'Create group' : 'Start conversation'}
                </Button>
            </DialogFooter>
        </form>
    );
};

export default NewConversationDialog;
