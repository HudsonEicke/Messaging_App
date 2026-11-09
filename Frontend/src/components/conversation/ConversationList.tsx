import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store/store';
import { useActiveIds } from '@/hooks/useActiveIds';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchConversations } from '@/store/conversationSlice';
import ConversationItem from './ConversationItem';

const PLACEHOLDER_COUNT = 5;

// fills the sidebar on /channels/@me: a fixed header, then DMs and groups, most recently active first
const ConversationList = () =>
{
    const dispatch = useDispatch<AppDispatch>();
    const { conversations, conversationsStatus, conversationsError } = useSelector((state: RootState) => state.conversation);
    const { conversationId } = useActiveIds();

    useEffect(() =>
    {
        dispatch(fetchConversations());
    }, [dispatch]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center border-b px-4">
                <h2 className="truncate text-sm font-semibold">Direct Messages</h2>
            </header>

            <ScrollArea className="min-h-0 flex-1">
                <nav aria-label="Direct messages" className="flex flex-col gap-0.5 py-3">
                    {
                        conversations.length > 0
                            ? conversations.map(conversation => (
                                <ConversationItem key={conversation.id} conversation={conversation} isActive={conversation.id === conversationId} />
                            ))
                            : conversationsStatus === 'failed'
                                ? (
                                    <div className="flex flex-col items-start gap-2 px-4">
                                        <p className="text-sm text-muted-foreground">{conversationsError?.message ?? 'Could not load conversations'}</p>
                                        <Button variant="outline" size="sm" onClick={() => dispatch(fetchConversations())}>
                                            Retry
                                        </Button>
                                    </div>
                                )
                                : conversationsStatus === 'succeeded'
                                    ? <p className="px-4 text-sm text-muted-foreground">No conversations yet</p>
                                    : Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
                                        // the placeholders never reorder, so the index is a safe key
                                        <div key={index} aria-hidden="true" className="mx-2 h-11 animate-pulse rounded-md bg-muted" />
                                    ))
                    }
                </nav>
            </ScrollArea>
        </div>
    );
};

export default ConversationList;
