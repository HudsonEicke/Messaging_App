import { memo, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Pencil, Reply, Trash2, User } from 'lucide-react';
import type { MessageReplyPreview, MessageResponse } from '@/types';
import { cn, getErrorMessage } from '@/lib/utils';
import { formatFullTimestamp, formatMessageTime, formatMessageTimestamp } from '@/lib/messageTime';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MESSAGE_MAX_LENGTH, getMessageElementId } from './messageSource';
import MessageMarkdown from './MessageMarkdown';

interface MessageItemProps
{
    message: MessageResponse;
    isGrouped: boolean;
    isHighlighted: boolean;
    canEdit: boolean;
    canDelete: boolean;
    isEditing: boolean;
    onReply: (message: MessageResponse) => void;
    onJumpToMessage: (messageID: number) => void;
    onStartEdit: (messageID: number) => void;
    onStopEdit: () => void;
    onEdit: (messageID: number, messageText: string) => Promise<void>;
    onDelete: (messageID: number) => Promise<void>;
}

const MessageItem = ({ message, isGrouped, isHighlighted, canEdit, canDelete, isEditing, onReply, onJumpToMessage, onStartEdit, onStopEdit, onEdit, onDelete }: MessageItemProps) =>
{
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const sentAt = new Date(message.timeSent);

    return (
        <li
            id={getMessageElementId(message.id)}
            className={cn(
                'group relative px-4 py-0.5 transition-colors hover:bg-muted/40 focus-within:bg-muted/40',
                !isGrouped && 'mt-4',
                isEditing && 'bg-muted/40',
                isHighlighted && 'bg-primary/10'
            )}
        >
            {message.replyTo && <ReplyPreview replyTo={message.replyTo} onJump={onJumpToMessage} />}

            <div className="flex gap-4">
                {
                    isGrouped
                        ? (
                            <time
                                dateTime={message.timeSent}
                                title={formatFullTimestamp(sentAt)}
                                className="-ml-2 w-12 shrink-0 pt-0.5 text-right text-[10px] leading-5 whitespace-nowrap text-muted-foreground opacity-0 group-hover:opacity-100"
                            >
                                {formatMessageTime(sentAt)}
                            </time>
                        )
                        : (
                            <Avatar className="mt-0.5 size-10 shrink-0">
                                <AvatarImage src={message.senderProfileImageUrl || undefined} alt="" />
                                <AvatarFallback><User className="size-5" aria-hidden="true" /></AvatarFallback>
                            </Avatar>
                        )
                }

                <div className="min-w-0 flex-1">
                    {
                        !isGrouped && (
                            <p className="flex items-baseline gap-2">
                                <span className="truncate text-sm font-medium" title={message.senderUsername}>{message.senderDisplayName}</span>
                                <time dateTime={message.timeSent} title={formatFullTimestamp(sentAt)} className="shrink-0 text-xs text-muted-foreground">
                                    {formatMessageTimestamp(sentAt)}
                                </time>
                            </p>
                        )
                    }

                    {
                        isEditing
                            ? <MessageEditor message={message} onCancel={onStopEdit} onSave={onEdit} />
                            : (
                                <div className="text-sm leading-5 break-words">
                                    <MessageMarkdown text={message.messageText} />
                                    {message.edited && <span className="ml-1 text-[11px] text-muted-foreground">(edited)</span>}
                                </div>
                            )
                    }
                </div>
            </div>

            {
                !isEditing && (
                    <div className="absolute -top-3 right-4 flex rounded-md border bg-popover p-0.5 opacity-0 shadow-sm group-hover:opacity-100 group-focus-within:opacity-100">
                        <ToolbarButton label="Reply" onClick={() => onReply(message)}><Reply className="size-4" aria-hidden="true" /></ToolbarButton>
                        {canEdit && <ToolbarButton label="Edit message" onClick={() => onStartEdit(message.id)}><Pencil className="size-4" aria-hidden="true" /></ToolbarButton>}
                        {canDelete && <ToolbarButton label="Delete message" destructive onClick={() => setIsDeleteOpen(true)}><Trash2 className="size-4" aria-hidden="true" /></ToolbarButton>}
                    </div>
                )
            }

            {canDelete && <DeleteMessageDialog message={message} open={isDeleteOpen} onOpenChange={setIsDeleteOpen} onDelete={onDelete} />}
        </li>
    );
};

// the corner line runs from above the avatar to the preview, like a thread connector
const ReplyPreview = ({ replyTo, onJump }: { replyTo: MessageReplyPreview; onJump: (messageID: number) => void }) =>
{
    return (
        <div className="relative flex h-5 items-center pl-14 text-xs">
            <span aria-hidden="true" className="absolute top-2.5 left-5 h-2.5 w-8 rounded-tl-md border-t-2 border-l-2 border-muted-foreground/40" />
            <button
                type="button"
                onClick={() => onJump(replyTo.id)}
                className="flex min-w-0 items-center gap-1 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
                <span className="sr-only">Replying to </span>
                <Avatar className="size-4 shrink-0">
                    <AvatarImage src={replyTo.senderProfileImageUrl || undefined} alt="" />
                    <AvatarFallback><User className="size-2.5" aria-hidden="true" /></AvatarFallback>
                </Avatar>
                <span className="shrink-0 font-medium">@{replyTo.senderDisplayName}</span>
                <span className="truncate">{replyTo.messageText}</span>
            </button>
        </div>
    );
};

interface ToolbarButtonProps
{
    label: string;
    destructive?: boolean;
    onClick: () => void;
    children: ReactNode;
}

const ToolbarButton = ({ label, destructive, onClick, children }: ToolbarButtonProps) =>
{
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={label}
                    onClick={onClick}
                    className={cn(
                        'flex size-7 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                        destructive ? 'hover:text-destructive' : 'hover:text-foreground'
                    )}
                >
                    {children}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
    );
};

interface MessageEditorProps
{
    message: MessageResponse;
    onCancel: () => void;
    onSave: (messageID: number, messageText: string) => Promise<void>;
}

const MessageEditor = ({ message, onCancel, onSave }: MessageEditorProps) =>
{
    const [draft, setDraft] = useState(message.messageText);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const save = async () =>
    {
        const messageText = draft.trim();

        // the backend rejects unchanged text, so treat it as a cancel
        if (messageText === message.messageText.trim())
        {
            onCancel();
            return;
        }

        if (messageText === '' || isSaving)
        {
            return;
        }

        setIsSaving(true);
        setSaveError(null);

        try
        {
            await onSave(message.id, messageText);
            onCancel();
        }
        catch (error)
        {
            setSaveError(getErrorMessage(error, 'Could not edit message'));
            setIsSaving(false);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) =>
    {
        if (event.key === 'Escape')
        {
            event.preventDefault();
            onCancel();
        }
        else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing)
        {
            event.preventDefault();
            save();
        }
    };

    return (
        <div className="py-1">
            <textarea
                autoFocus
                value={draft}
                maxLength={MESSAGE_MAX_LENGTH}
                aria-label="Edit message"
                aria-invalid={saveError !== null}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={event => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)}
                className="block field-sizing-content max-h-[50vh] min-h-10 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <p className="mt-1 text-xs text-muted-foreground">
                Escape to <button type="button" className="text-primary hover:underline" onClick={onCancel}>cancel</button>
                {' · '}
                Enter to <button type="button" className="text-primary hover:underline" disabled={isSaving} onClick={save}>save</button>
            </p>
            {saveError && <p role="alert" className="mt-1 text-sm text-destructive">{saveError}</p>}
        </div>
    );
};

interface DeleteMessageDialogProps
{
    message: MessageResponse;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDelete: (messageID: number) => Promise<void>;
}

const DeleteMessageDialog = ({ message, open, onOpenChange, onDelete }: DeleteMessageDialogProps) =>
{
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
            await onDelete(message.id);
        }
        catch (error)
        {
            setDeleteError(getErrorMessage(error, 'Could not delete message'));
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete message?</AlertDialogTitle>
                    <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                </AlertDialogHeader>

                <blockquote className="max-h-40 overflow-y-auto rounded-md border bg-muted/40 px-3 py-2 text-sm break-words whitespace-pre-wrap">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">{message.senderDisplayName}</span>
                    {message.messageText}
                </blockquote>

                {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" disabled={isDeleting} onClick={handleDelete}>
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default memo(MessageItem);
