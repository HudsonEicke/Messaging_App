import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AtSign, Crown, MessageCircle, User } from 'lucide-react';
import type { UserResponse } from '@/types';
import { ActivityStatus } from '@/types';
import type { AppDispatch, RootState } from '@/store/store';
import { createConversation, fetchConversations } from '@/store/conversationSlice';
import { cn, copyToClipboard } from '@/lib/utils';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/user/StatusBadge';

interface MemberListProps
{
    members: UserResponse[] | undefined;
    ownerUsername: string | undefined;
    loadError: string | null;
    onRetry: () => void;
}

const byDisplayName = (first: UserResponse, second: UserResponse) => first.displayName.localeCompare(second.displayName, undefined, { sensitivity: 'base' });

// away and dnd count as online, matching what the badge shows
const MemberList = ({ members, ownerUsername, loadError, onRetry }: MemberListProps) =>
{
    const renderContent = () =>
    {
        if (members === undefined)
        {
            return loadError
                ? (
                    <div className="flex flex-col items-start gap-2 p-4 text-sm text-muted-foreground">
                        <p>{loadError}</p>
                        <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
                    </div>
                )
                : <p className="p-4 text-sm text-muted-foreground">Loading members...</p>;
        }

        const onlineMembers = members.filter(member => member.activityStatus !== ActivityStatus.offline).sort(byDisplayName);
        const offlineMembers = members.filter(member => member.activityStatus === ActivityStatus.offline).sort(byDisplayName);

        return (
            <>
                <MemberSection title="Online" members={onlineMembers} ownerUsername={ownerUsername} />
                <MemberSection title="Offline" members={offlineMembers} ownerUsername={ownerUsername} />
            </>
        );
    };

    return (
        // overlays the messages below lg instead of squeezing them
        <aside
            aria-label="Members"
            className="flex w-60 shrink-0 flex-col overflow-y-auto border-l bg-sidebar pb-4 max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:shadow-lg"
        >
            {renderContent()}
        </aside>
    );
};

interface MemberSectionProps
{
    title: string;
    members: UserResponse[];
    ownerUsername: string | undefined;
}

const MemberSection = ({ title, members, ownerUsername }: MemberSectionProps) =>
{
    if (members.length === 0)
    {
        return null;
    }

    return (
        <section>
            <h2 className="px-4 pt-5 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {title} — {members.length}
            </h2>
            <ul className="px-2">
                {
                    members.map(member => (
                        <MemberRow key={member.username} member={member} isOwner={member.username === ownerUsername} />
                    ))
                }
            </ul>
        </section>
    );
};

const MemberRow = ({ member, isOwner }: { member: UserResponse; isOwner: boolean }) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const currentUsername = useSelector((state: RootState) => state.user.user?.username);
    const isOffline = member.activityStatus === ActivityStatus.offline;
    const isSelf = member.username === currentUsername;

    // creating a DM that already exists returns the existing one
    const openDirectMessage = async () =>
    {
        try
        {
            const conversation = await dispatch(createConversation({ memberUsernames: [member.username] })).unwrap();
            dispatch(fetchConversations());
            navigate(`/channels/@me/${conversation.id}`);
        }
        catch
        {
            // the menu has already closed, so there is nowhere to show the error yet
        }
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <li title={member.username} className={cn('flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-sidebar-accent/50', isOffline && 'opacity-50 hover:opacity-100')}>
                    <Avatar className="size-8 shrink-0">
                        <AvatarImage src={member.profileImageUrl || undefined} alt="" />
                        <AvatarFallback><User className="size-4" aria-hidden="true" /></AvatarFallback>
                        <StatusBadge status={member.activityStatus} />
                    </Avatar>

                    <span className="min-w-0 flex-1 truncate text-sm">{member.displayName}</span>

                    {
                        isOwner && (
                            <span title="Owner" className="shrink-0">
                                <Crown className="size-3.5 text-amber-500" fill="currentColor" aria-hidden="true" />
                                <span className="sr-only">Owner</span>
                            </span>
                        )
                    }
                </li>
            </ContextMenuTrigger>

            <ContextMenuContent className="w-48">
                {
                    !isSelf && (
                        <ContextMenuItem onSelect={openDirectMessage}>
                            <MessageCircle aria-hidden="true" />
                            Message
                        </ContextMenuItem>
                    )
                }
                <ContextMenuItem onSelect={() => copyToClipboard(member.username)}>
                    <AtSign aria-hidden="true" />
                    Copy username
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};

export default MemberList;
