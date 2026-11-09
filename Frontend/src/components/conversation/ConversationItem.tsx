import { NavLink } from 'react-router-dom';
import { Settings, User, Users, X } from 'lucide-react';
import type { ConversationResponse } from '@/types';
import { ConversationType } from '@/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const MAX_SHOWN_UNREAD = 99;

interface ConversationItemProps
{
    conversation: ConversationResponse;
    isActive: boolean;
    onClose: (conversationId: number) => void;
    onOpenSettings: (conversationId: number) => void;
}

// one row in the DM list; for a DM the backend already fills in the other user's display name and picture
const ConversationItem = ({ conversation, isActive, onClose, onOpenSettings }: ConversationItemProps) =>
{
    const hasUnread = conversation.unreadCount > 0;
    const isGroup = conversation.conversationType === ConversationType.group;
    const FallbackIcon = isGroup ? Users : User;
    const ActionIcon = isGroup ? Settings : X;
    const actionLabel = isGroup ? 'Group settings' : 'Close conversation';

    return (
        <div className="group relative px-2">
            <NavLink
                to={`/channels/@me/${conversation.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                    'flex h-11 items-center gap-3 rounded-md pr-9 pl-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                    isActive
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                        : cn(
                            'hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                            hasUnread ? 'font-semibold text-sidebar-foreground' : 'text-muted-foreground'
                        )
                )}
            >
                <Avatar className="size-8">
                    <AvatarImage src={conversation.iconUrl} alt="" />
                    <AvatarFallback>
                        <FallbackIcon className="size-4" aria-hidden="true" />
                    </AvatarFallback>
                </Avatar>

                <span className="min-w-0 flex-1 truncate">{conversation.conversationName}</span>

                {
                    hasUnread && (
                        // the backend caps the count at 100, so anything over 99 can only say "99+"
                        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white">
                            {conversation.unreadCount > MAX_SHOWN_UNREAD ? `${MAX_SHOWN_UNREAD}+` : conversation.unreadCount}
                            <span className="sr-only"> unread messages</span>
                        </span>
                    )
                }
            </NavLink>

            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label={`${actionLabel}: ${conversation.conversationName}`}
                        onClick={() => (isGroup ? onOpenSettings : onClose)(conversation.id)}
                        className={cn(
                            'absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground outline-none transition-opacity hover:text-sidebar-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover:opacity-100',
                            isActive ? 'opacity-100' : 'opacity-0'
                        )}
                    >
                        <ActionIcon className="size-4" aria-hidden="true" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top">{actionLabel}</TooltipContent>
            </Tooltip>
        </div>
    );
};

export default ConversationItem;
