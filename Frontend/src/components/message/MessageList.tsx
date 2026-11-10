import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import type { MessageResponse } from '@/types';
import type { RootState } from '@/store/store';
import { getBlockedRuns } from '@/lib/blockedRuns';
import { useWindowFocus } from '@/hooks/useWindowFocus';
import { formatDayDivider, isSameDay, isWithinGroupWindow } from '@/lib/messageTime';
import { Button } from '@/components/ui/button';
import type { MessageSource } from './messageSource';
import { getMessageElementId } from './messageSource';
import MessageItem from './MessageItem';

const BOTTOM_THRESHOLD_PX = 48;
const LOAD_OLDER_MARGIN_PX = 300;
const MARK_READ_DELAY_MS = 500;
const HIGHLIGHT_MS = 2000;
const JUMP_NOTICE_MS = 4000;

interface MessageListProps
{
    source: MessageSource;
    currentUsername: string | undefined;
    intro: ReactNode;
    onReply: (message: MessageResponse) => void;
}

const MessageList = ({ source, currentUsername, intro, onReply }: MessageListProps) =>
{
    const { messages, status, error, hasMore, hasUnread, canDeleteOthers, reload, loadOlder, edit, remove, markRead, setReading, ensureLoaded } = source;
    const scrollRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const scrollSnapshotRef = useRef({ scrollTop: 0, scrollHeight: 0 });
    const edgeIdsRef = useRef<{ first?: number; last?: number } | null>(null);
    const markedMessageIdRef = useRef<number | null>(null);
    const pendingScrollIdRef = useRef<number | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
    const [isJumping, setIsJumping] = useState(false);
    const [jumpNotice, setJumpNotice] = useState<string | null>(null);
    const [isBottomVisible, setIsBottomVisible] = useState(false);
    // a blocked run shows if any of its messages is in here, from Show or from jumping to one
    const [revealedMessageIds, setRevealedMessageIds] = useState<Set<number>>(() => new Set());
    const blockedUsers = useSelector((state: RootState) => state.friend.blockedUsers);
    const isWindowFocused = useWindowFocus();

    const lastMessage = messages?.at(-1);
    const lastMessageId = lastMessage?.id;

    const rememberScroll = useCallback(() =>
    {
        const scrollElement = scrollRef.current;

        if (scrollElement)
        {
            isAtBottomRef.current = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight < BOTTOM_THRESHOLD_PX;
            scrollSnapshotRef.current = { scrollTop: scrollElement.scrollTop, scrollHeight: scrollElement.scrollHeight };
        }
    }, []);

    // runs before paint so the list never flashes at the wrong position
    useLayoutEffect(() =>
    {
        const scrollElement = scrollRef.current;

        if (!scrollElement || messages === undefined)
        {
            return;
        }

        const firstId = messages[0]?.id;
        const previousEdges = edgeIdsRef.current;
        const wasPrepended = previousEdges !== null && firstId !== previousEdges.first && lastMessageId === previousEdges.last;
        const sentOwnMessage = previousEdges !== null && lastMessageId !== previousEdges.last && lastMessage?.senderUsername === currentUsername;

        if (wasPrepended)
        {
            // keep the message you were looking at in the same place after older ones load above it
            const { scrollTop, scrollHeight } = scrollSnapshotRef.current;
            scrollElement.scrollTop = scrollTop + (scrollElement.scrollHeight - scrollHeight);
        }
        else if (previousEdges === null || isAtBottomRef.current || sentOwnMessage)
        {
            scrollElement.scrollTop = scrollElement.scrollHeight;
        }

        edgeIdsRef.current = { first: firstId, last: lastMessageId };

        // a jump target that just loaded is only in the DOM now
        const pendingScrollId = pendingScrollIdRef.current;
        const pendingElement = pendingScrollId === null ? null : document.getElementById(getMessageElementId(pendingScrollId));

        if (pendingElement)
        {
            pendingElement.scrollIntoView({ block: 'center' });
            pendingScrollIdRef.current = null;
        }

        rememberScroll();
    }, [messages, lastMessage, lastMessageId, currentUsername, rememberScroll]);

    // the composer growing or the window resizing shouldn't pull you away from the newest message
    useEffect(() =>
    {
        const scrollElement = scrollRef.current;

        if (!scrollElement)
        {
            return;
        }

        const observer = new ResizeObserver(() =>
        {
            if (isAtBottomRef.current)
            {
                scrollElement.scrollTop = scrollElement.scrollHeight;
            }

            rememberScroll();
        });

        observer.observe(scrollElement);
        return () => observer.disconnect();
    }, [rememberScroll]);

    useEffect(() =>
    {
        const sentinel = topSentinelRef.current;
        const scrollElement = scrollRef.current;

        if (!sentinel || !scrollElement || !hasMore || status === 'loading' || status === 'failed')
        {
            return;
        }

        const observer = new IntersectionObserver(
            entries =>
            {
                if (entries[0]?.isIntersecting)
                {
                    loadOlder();
                }
            },
            { root: scrollElement, rootMargin: `${LOAD_OLDER_MARGIN_PX}px 0px 0px 0px` }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, status, loadOlder]);

    useEffect(() =>
    {
        const sentinel = bottomSentinelRef.current;
        const scrollElement = scrollRef.current;

        if (!sentinel || !scrollElement)
        {
            return;
        }

        const observer = new IntersectionObserver(entries => setIsBottomVisible(entries[0]?.isIntersecting ?? false), { root: scrollElement });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    // the same conditions the mark-read below waits for, so the hub handlers can treat a new message as read straight away
    const isReading = isBottomVisible && isWindowFocused && messages !== undefined;

    useEffect(() =>
    {
        if (!isReading)
        {
            return;
        }

        setReading(true);
        return () => setReading(false);
    }, [isReading, setReading]);

    useEffect(() =>
    {
        if (!hasUnread || !isBottomVisible || !isWindowFocused || lastMessageId === undefined || markedMessageIdRef.current === lastMessageId)
        {
            return;
        }

        const timer = setTimeout(() =>
        {
            markedMessageIdRef.current = lastMessageId;
            markRead(lastMessageId);
        }, MARK_READ_DELAY_MS);

        return () => clearTimeout(timer);
    }, [hasUnread, isBottomVisible, isWindowFocused, lastMessageId, markRead]);

    useEffect(() =>
    {
        if (highlightedMessageId === null)
        {
            return;
        }

        const timer = setTimeout(() => setHighlightedMessageId(null), HIGHLIGHT_MS);
        return () => clearTimeout(timer);
    }, [highlightedMessageId]);

    useEffect(() =>
    {
        if (jumpNotice === null)
        {
            return;
        }

        const timer = setTimeout(() => setJumpNotice(null), JUMP_NOTICE_MS);
        return () => clearTimeout(timer);
    }, [jumpNotice]);

    // a jump target that was hidden as a blocked message is only in the DOM once it's revealed
    useLayoutEffect(() =>
    {
        const pendingScrollId = pendingScrollIdRef.current;
        const pendingElement = pendingScrollId === null ? null : document.getElementById(getMessageElementId(pendingScrollId));

        if (pendingElement)
        {
            pendingElement.scrollIntoView({ block: 'center' });
            pendingScrollIdRef.current = null;
        }
    }, [revealedMessageIds]);

    const jumpToMessage = useCallback(async (messageID: number) =>
    {
        setJumpNotice(null);
        setIsJumping(true);

        try
        {
            const isFound = await ensureLoaded(messageID);

            if (!isFound)
            {
                setJumpNotice("That message isn't available anymore");
                return;
            }

            // harmless for a message that isn't blocked, so there's no need to check
            setRevealedMessageIds(previousIds => new Set(previousIds).add(messageID));

            const element = document.getElementById(getMessageElementId(messageID));

            if (element)
            {
                element.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
            else
            {
                pendingScrollIdRef.current = messageID;
            }

            setHighlightedMessageId(messageID);
        }
        catch
        {
            setJumpNotice('Could not load older messages');
        }
        finally
        {
            setIsJumping(false);
        }
    }, [ensureLoaded]);

    const stopEditing = useCallback(() => setEditingMessageId(null), []);

    const toggleBlockedRun = (runIds: number[], isRevealed: boolean) =>
    {
        setRevealedMessageIds(previousIds =>
        {
            const nextIds = new Set(previousIds);
            runIds.forEach(id => { if (isRevealed) nextIds.delete(id); else nextIds.add(id); });
            return nextIds;
        });
    };

    const renderMessages = () =>
    {
        if (messages === undefined)
        {
            return (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                    {
                        status === 'failed'
                            ? (
                                <>
                                    <p>{error?.message ?? 'Could not load messages'}</p>
                                    <Button variant="outline" size="sm" onClick={reload}>Try again</Button>
                                </>
                            )
                            : <p>Loading messages...</p>
                    }
                </div>
            );
        }

        const blockedRuns = getBlockedRuns(messages, new Set(blockedUsers.map(user => user.username)));

        return (
            <>
                {
                    hasMore
                        ? (
                            // fixed height so the spinner appearing doesn't shift the messages below it
                            <div ref={topSentinelRef} className="flex h-12 shrink-0 items-center justify-center gap-2 text-xs text-muted-foreground">
                                {status === 'loading' && <span>Loading older messages...</span>}
                                {
                                    status === 'failed' && (
                                        <>
                                            <span>{error?.message ?? 'Could not load messages'}</span>
                                            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={loadOlder}>Try again</Button>
                                        </>
                                    )
                                }
                            </div>
                        )
                        : <div className="px-4 pt-8">{intro}</div>
                }

                <ul aria-label="Messages">
                    {
                        messages.map((message, index) =>
                        {
                            const previous = index > 0 ? messages[index - 1] : undefined;
                            const sentAt = new Date(message.timeSent);
                            const previousSentAt = previous ? new Date(previous.timeSent) : undefined;
                            const startsNewDay = previousSentAt === undefined || !isSameDay(previousSentAt, sentAt);
                            // a reply always shows its own name so the preview line has something to attach to
                            const isGrouped = previousSentAt !== undefined && !startsNewDay && !message.replyTo && previous?.senderUsername === message.senderUsername && isWithinGroupWindow(previousSentAt, sentAt);
                            const isOwn = message.senderUsername === currentUsername;
                            const runStartId = blockedRuns.runStartById.get(message.id);
                            const runIds = runStartId === undefined ? undefined : blockedRuns.runIdsByStart.get(runStartId);
                            const isRunRevealed = runIds?.some(id => revealedMessageIds.has(id)) ?? false;

                            // the rest of a hidden run is covered by the row on its first message
                            if (runIds && !isRunRevealed && message.id !== runStartId)
                            {
                                return null;
                            }

                            return (
                                <Fragment key={message.id}>
                                    {
                                        startsNewDay && (
                                            <li role="separator" aria-label={formatDayDivider(sentAt)} className="mx-4 mt-6 mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                                <span className="h-px flex-1 bg-border" />
                                                <span aria-hidden="true">{formatDayDivider(sentAt)}</span>
                                                <span className="h-px flex-1 bg-border" />
                                            </li>
                                        )
                                    }
                                    {
                                        runIds && message.id === runStartId && (
                                            <li className="mx-4 my-1">
                                                <button
                                                    type="button"
                                                    aria-expanded={isRunRevealed}
                                                    onClick={() => toggleBlockedRun(runIds, isRunRevealed)}
                                                    className="rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                                                >
                                                    {runIds.length} blocked {runIds.length === 1 ? 'message' : 'messages'} · {isRunRevealed ? 'Hide' : 'Show'}
                                                </button>
                                            </li>
                                        )
                                    }
                                    {
                                        (!runIds || isRunRevealed) && (
                                            <MessageItem
                                                message={message}
                                                isGrouped={isGrouped}
                                                isHighlighted={highlightedMessageId === message.id}
                                                canEdit={isOwn}
                                                canDelete={isOwn || canDeleteOthers}
                                                isEditing={editingMessageId === message.id}
                                                onReply={onReply}
                                                onJumpToMessage={jumpToMessage}
                                                onStartEdit={setEditingMessageId}
                                                onStopEdit={stopEditing}
                                                onEdit={edit}
                                                onDelete={remove}
                                            />
                                        )
                                    }
                                </Fragment>
                            );
                        })
                    }
                </ul>
            </>
        );
    };

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            {/* overflow-anchor is off because the scroll position is restored by hand after older messages load */}
            <div ref={scrollRef} onScroll={rememberScroll} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]">
                <div className="flex min-h-full flex-col justify-end">
                    {renderMessages()}
                    <div ref={bottomSentinelRef} className="h-4 shrink-0" />
                </div>
            </div>

            {
                (isJumping || jumpNotice) && (
                    <p role="status" className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full border bg-popover px-3 py-1 text-xs shadow-sm">
                        {isJumping ? 'Jumping to message...' : jumpNotice}
                    </p>
                )
            }
        </div>
    );
};

export default MessageList;
