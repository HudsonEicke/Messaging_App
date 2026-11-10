import { useDispatch, useSelector } from 'react-redux';
import { AtSign, Crown, MessageCircle, RotateCw, User, UserPlus } from 'lucide-react';
import type { UserResponse } from '@/types';
import { ActivityStatus } from '@/types';
import type { AppDispatch, RootState } from '@/store/store';
import { sendFriendRequest } from '@/store/friendSlice';
import { useOpenDirectMessage } from '@/hooks/useOpenDirectMessage';
import { cn, copyToClipboard } from '@/lib/utils';
import { byDisplayName } from '@/lib/userSort';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import StatusBadge from '@/components/user/StatusBadge';

interface MemberListProps
{
    members: UserResponse[] | undefined;
    ownerUsername: string | undefined;
    loadError: string | null;
    onRetry: () => void;
}

// away and dnd count as online, matching what the badge shows
const MemberList = ({ members, ownerUsername, loadError, onRetry }: MemberListProps) =>
{
    const renderContent = () =>
    {
        if (members === undefined)
        {
            return loadError
                ? (
                    <div className="flex flex-col items-start gap-2 p-4 text-sm text-muted-foreground @max-2xl:items-center @max-2xl:px-0">
                        <p className="@max-2xl:sr-only">{loadError}</p>
                        <Button variant="outline" size="sm" onClick={onRetry} className="@max-2xl:hidden">Try again</Button>
                        <Button variant="outline" size="icon" onClick={onRetry} title="Try again" aria-label="Try again" className="hidden @max-2xl:inline-flex">
                            <RotateCw aria-hidden="true" />
                        </Button>
                    </div>
                )
                : <p className="p-4 text-sm text-muted-foreground @max-2xl:sr-only">Loading members...</p>;
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
        // sized from the chat area, which the page marks as the @container; below 42rem it becomes an avatar-only rail
        <aside aria-label="Members" className="flex w-[clamp(12rem,30cqw,15rem)] shrink-0 flex-col border-l bg-sidebar @max-2xl:w-16">
            {/* Radix wraps the content in a display: table div, which stops long names from truncating */}
            <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:block!">
                <div className="pb-4">
                    {renderContent()}
                </div>
            </ScrollArea>
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
        // in the rail the heading is only for screen readers, and a divider separates the sections
        <section className="@max-2xl:pt-3 @max-2xl:not-first:mt-3 @max-2xl:not-first:border-t">
            <h2 className="px-4 pt-5 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase @max-2xl:sr-only">
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
    const openDirectMessageWith = useOpenDirectMessage();
    const currentUsername = useSelector((state: RootState) => state.user.user?.username);
    // an incoming request still shows Add Friend, since sending one back accepts it
    const canAddFriend = useSelector((state: RootState) =>
        ![state.friend.friends, state.friend.outgoingRequests, state.friend.blockedUsers].some(users => users.some(user => user.username === member.username)));
    const isOffline = member.activityStatus === ActivityStatus.offline;
    const isSelf = member.username === currentUsername;

    const openDirectMessage = async () =>
    {
        try
        {
            await openDirectMessageWith(member.username);
        }
        catch
        {
            // the menu has already closed, so there is nowhere to show the error yet
        }
    };

    // a failed request is likewise silent; the thunk resolves with the error instead of throwing
    const addFriend = () =>
    {
        dispatch(sendFriendRequest(member.username));
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <li title={`${member.displayName} (${member.username})`} className={cn('flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-sidebar-accent/50 @max-2xl:justify-center', isOffline && 'opacity-50 hover:opacity-100')}>
                    <Avatar className="size-8 shrink-0">
                        <AvatarImage src={member.profileImageUrl || undefined} alt="" />
                        <AvatarFallback><User className="size-4" aria-hidden="true" /></AvatarFallback>
                        <StatusBadge status={member.activityStatus} />
                    </Avatar>

                    <span className="min-w-0 flex-1 truncate text-sm @max-2xl:sr-only">{member.displayName}</span>

                    {
                        isOwner && (
                            <span title="Owner" className="shrink-0 @max-2xl:sr-only">
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
                {
                    !isSelf && canAddFriend && (
                        <ContextMenuItem onSelect={addFriend}>
                            <UserPlus aria-hidden="true" />
                            Add Friend
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
