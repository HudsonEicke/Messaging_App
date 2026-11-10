import { useState } from 'react';
import type { ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Ban, Check, EllipsisVertical, MessageCircle, UserMinus, Users, X } from 'lucide-react';
import type { UserResponse } from '@/types';
import { ActivityStatus } from '@/types';
import type { AppDispatch, RootState } from '@/store/store';
import { acceptFriendRequest, deleteFriendRequest, fetchFriendData, unblockUser } from '@/store/friendSlice';
import { useOpenDirectMessage } from '@/hooks/useOpenDirectMessage';
import { activityStatusDisplay } from '@/lib/activityStatus';
import { byDisplayName } from '@/lib/userSort';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AddFriendForm from '@/components/friend/AddFriendForm';
import FriendActionDialog from '@/components/friend/FriendActionDialog';
import type { FriendAction } from '@/components/friend/FriendActionDialog';
import FriendRow from '@/components/friend/FriendRow';
import RowActionButton from '@/components/friend/RowActionButton';

type FriendsTab = 'online' | 'all' | 'pending' | 'blocked' | 'add';

const MAX_SHOWN_REQUESTS = 99;

// the /channels/@me home: friends, requests and blocked users, Discord-style
export const FriendsPage = () =>
{
    const dispatch = useDispatch<AppDispatch>();
    const openDirectMessage = useOpenDirectMessage();
    const { friends, incomingRequests, outgoingRequests, blockedUsers, hasLoaded, status, error } = useSelector((state: RootState) => state.friend);
    const [tab, setTab] = useState<FriendsTab>('online');
    const [busyUsername, setBusyUsername] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [dialogTarget, setDialogTarget] = useState<{ user: UserResponse; action: FriendAction } | null>(null);

    const sortedFriends = [...friends].sort(byDisplayName);
    const onlineFriends = sortedFriends.filter(friend => friend.activityStatus !== ActivityStatus.offline);

    const changeTab = (value: string) =>
    {
        setTab(value as FriendsTab);
        setActionError(null);
    };

    // one action at a time per row, with any error shown above the list
    const runAction = async (username: string, action: () => Promise<unknown>, fallbackError: string) =>
    {
        setBusyUsername(username);
        setActionError(null);

        try
        {
            await action();
        }
        catch (actionFailure)
        {
            setActionError(getErrorMessage(actionFailure, fallbackError));
        }
        finally
        {
            setBusyUsername(null);
        }
    };

    const renderFriendActions = (friend: UserResponse) => (
        <>
            <RowActionButton
                label="Message"
                Icon={MessageCircle}
                disabled={busyUsername === friend.username}
                onClick={() => runAction(friend.username, () => openDirectMessage(friend.username), 'Could not open conversation')}
            />

            {/* non-modal so the menu closing doesn't fight the dialog it opens for focus */}
            <DropdownMenu modal={false}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="More">
                                <EllipsisVertical aria-hidden="true" />
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">More</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onSelect={() => setDialogTarget({ user: friend, action: 'remove' })}>
                        <UserMinus aria-hidden="true" />
                        Remove Friend
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setDialogTarget({ user: friend, action: 'block' })}>
                        <Ban aria-hidden="true" />
                        Block
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );

    const renderFriendRows = (users: UserResponse[]) => users.map(friend => (
        <FriendRow
            key={friend.username}
            user={friend}
            subtitle={activityStatusDisplay[friend.activityStatus]?.label ?? 'Offline'}
            showStatus
            actions={renderFriendActions(friend)}
        />
    ));

    // the Add Friend tab works before the lists load, so only the list tabs wait for them
    const renderList = (content: ReactNode) =>
    {
        if (!hasLoaded)
        {
            return status === 'failed'
                ? (
                    <div className="flex flex-col items-start gap-2">
                        <p className="text-sm text-muted-foreground">{error?.message ?? 'Could not load friends'}</p>
                        <Button variant="outline" size="sm" onClick={() => dispatch(fetchFriendData())}>Retry</Button>
                    </div>
                )
                : <p className="text-sm text-muted-foreground">Loading friends...</p>;
        }

        return (
            <>
                {actionError && <p role="alert" className="mb-3 text-sm text-destructive">{actionError}</p>}
                {content}
            </>
        );
    };

    return (
        <section aria-label="Friends" className="flex min-h-0 min-w-0 flex-1 flex-col @container">
            <Tabs value={tab} onValueChange={changeTab} className="flex min-h-0 flex-1 flex-col gap-0">
                <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
                    <Users className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {/* on a narrow chat area the title and divider make room for the tabs */}
                    <h1 className="shrink-0 text-sm font-semibold @max-lg:sr-only">Friends</h1>
                    <Separator orientation="vertical" className="my-3 @max-lg:hidden" />

                    <TabsList variant="line" className="min-w-0 justify-start">
                        <TabsTrigger value="online" className="flex-none">Online</TabsTrigger>
                        <TabsTrigger value="all" className="flex-none">All</TabsTrigger>
                        <TabsTrigger value="pending" className="flex-none">
                            Pending
                            {
                                incomingRequests.length > 0 && (
                                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white">
                                        {incomingRequests.length > MAX_SHOWN_REQUESTS ? `${MAX_SHOWN_REQUESTS}+` : incomingRequests.length}
                                        <span className="sr-only"> incoming</span>
                                    </span>
                                )
                            }
                        </TabsTrigger>
                        <TabsTrigger value="blocked" className="flex-none">Blocked</TabsTrigger>
                        <TabsTrigger value="add" className="flex-none text-primary data-active:text-primary dark:text-primary dark:data-active:text-primary">
                            Add Friend
                        </TabsTrigger>
                    </TabsList>
                </header>

                <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:block!">
                    <div className="p-4">
                        <TabsContent value="online">
                            {
                                renderList(
                                    <ListSection title="Online" count={onlineFriends.length} emptyText="None of your friends are online right now.">
                                        {renderFriendRows(onlineFriends)}
                                    </ListSection>
                                )
                            }
                        </TabsContent>

                        <TabsContent value="all">
                            {
                                renderList(
                                    sortedFriends.length > 0
                                        ? (
                                            <ListSection title="All friends" count={sortedFriends.length}>
                                                {renderFriendRows(sortedFriends)}
                                            </ListSection>
                                        )
                                        : (
                                            <div className="flex flex-col items-start gap-2">
                                                <p className="text-sm text-muted-foreground">You haven't added any friends yet.</p>
                                                <Button size="sm" onClick={() => changeTab('add')}>Add Friend</Button>
                                            </div>
                                        )
                                )
                            }
                        </TabsContent>

                        <TabsContent value="pending">
                            {
                                renderList(
                                    incomingRequests.length === 0 && outgoingRequests.length === 0
                                        ? <p className="text-sm text-muted-foreground">No pending friend requests.</p>
                                        : (
                                            <div className="flex flex-col gap-6">
                                                <ListSection title="Incoming" count={incomingRequests.length}>
                                                    {
                                                        [...incomingRequests].sort(byDisplayName).map(user => (
                                                            <FriendRow
                                                                key={user.username}
                                                                user={user}
                                                                subtitle={user.username}
                                                                showStatus={false}
                                                                actions={
                                                                    <>
                                                                        <RowActionButton
                                                                            label="Accept"
                                                                            Icon={Check}
                                                                            disabled={busyUsername === user.username}
                                                                            onClick={() => runAction(user.username, () => dispatch(acceptFriendRequest(user.username)).unwrap(), 'Could not accept friend request')}
                                                                        />
                                                                        <RowActionButton
                                                                            label="Decline"
                                                                            Icon={X}
                                                                            isDestructive
                                                                            disabled={busyUsername === user.username}
                                                                            onClick={() => runAction(user.username, () => dispatch(deleteFriendRequest(user.username)).unwrap(), 'Could not decline friend request')}
                                                                        />
                                                                    </>
                                                                }
                                                            />
                                                        ))
                                                    }
                                                </ListSection>

                                                <ListSection title="Sent" count={outgoingRequests.length}>
                                                    {
                                                        [...outgoingRequests].sort(byDisplayName).map(user => (
                                                            <FriendRow
                                                                key={user.username}
                                                                user={user}
                                                                subtitle={user.username}
                                                                showStatus={false}
                                                                actions={
                                                                    <RowActionButton
                                                                        label="Cancel request"
                                                                        Icon={X}
                                                                        isDestructive
                                                                        disabled={busyUsername === user.username}
                                                                        onClick={() => runAction(user.username, () => dispatch(deleteFriendRequest(user.username)).unwrap(), 'Could not cancel friend request')}
                                                                    />
                                                                }
                                                            />
                                                        ))
                                                    }
                                                </ListSection>
                                            </div>
                                        )
                                )
                            }
                        </TabsContent>

                        <TabsContent value="blocked">
                            {
                                renderList(
                                    <ListSection title="Blocked" count={blockedUsers.length} emptyText="You haven't blocked anyone.">
                                        {
                                            [...blockedUsers].sort(byDisplayName).map(user => (
                                                <FriendRow
                                                    key={user.username}
                                                    user={user}
                                                    subtitle={user.username}
                                                    showStatus={false}
                                                    actions={
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={busyUsername === user.username}
                                                            onClick={() => runAction(user.username, () => dispatch(unblockUser(user.username)).unwrap(), 'Could not unblock user')}
                                                        >
                                                            Unblock
                                                        </Button>
                                                    }
                                                />
                                            ))
                                        }
                                    </ListSection>
                                )
                            }
                        </TabsContent>

                        <TabsContent value="add">
                            <AddFriendForm />
                        </TabsContent>
                    </div>
                </ScrollArea>
            </Tabs>

            {
                dialogTarget && (
                    <FriendActionDialog
                        key={`${dialogTarget.user.username}-${dialogTarget.action}`}
                        user={dialogTarget.user}
                        action={dialogTarget.action}
                        open
                        onOpenChange={open => { if (!open) setDialogTarget(null); }}
                    />
                )
            }
        </section>
    );
};

interface ListSectionProps
{
    title: string;
    count: number;
    // shown instead of the list when it's empty; without it an empty section is hidden
    emptyText?: string;
    children: ReactNode;
}

const ListSection = ({ title, count, emptyText, children }: ListSectionProps) =>
{
    if (count === 0)
    {
        return emptyText ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null;
    }

    return (
        <section>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {title} — {count}
            </h2>
            <ul>{children}</ul>
        </section>
    );
};
