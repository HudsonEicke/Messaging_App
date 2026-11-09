import { NavLink } from 'react-router-dom';
import { User, Users } from 'lucide-react';
import type { ConversationResponse } from '@/types';
import { ConversationType } from '@/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const MAX_SHOWN_UNREAD = 99;

interface ConversationItemProps
{
    conversation: ConversationResponse;
    isActive: boolean;
}

// one row in the DM list; for a DM the backend already fills in the other user's display name and picture
const ConversationItem = ({ conversation, isActive }: ConversationItemProps) =>
{
    const hasUnread = conversation.unreadCount > 0;
    const FallbackIcon = conversation.conversationType === ConversationType.group ? Users : User;

    return (
        <div className="px-2">
            <NavLink
                to={`/channels/@me/${conversation.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                    'flex h-11 items-center gap-3 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
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
        </div>
    );
};

export default ConversationItem;
