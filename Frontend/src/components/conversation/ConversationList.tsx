import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { AppDispatch, RootState } from '@/store/store';
import { useActiveIds } from '@/hooks/useActiveIds';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fetchConversations, leaveConversation } from '@/store/conversationSlice';
import { getErrorMessage } from '@/lib/utils';
import ConversationItem from './ConversationItem';
import GroupSettingsDialog from './GroupSettingsDialog';
import NewConversationDialog from './NewConversationDialog';

const PLACEHOLDER_COUNT = 5;

// fills the sidebar on /channels/@me: a fixed header, then DMs and groups, most recently active first
const ConversationList = () =>
{
    const dispatch = useDispatch<AppDispatch>();
    const { conversations, conversationsStatus, conversationsError } = useSelector((state: RootState) => state.conversation);
    const { conversationId } = useActiveIds();
    const navigate = useNavigate();
    const [isNewOpen, setIsNewOpen] = useState(false);
    const [settingsConversationId, setSettingsConversationId] = useState<number | null>(null);
    const [closeError, setCloseError] = useState<string | null>(null);

    const settingsConversation = conversations.find(conversation => conversation.id === settingsConversationId);

    useEffect(() =>
    {
        dispatch(fetchConversations());
    }, [dispatch]);

    // no confirmation: messaging the same person again reopens the DM with its history
    const handleCloseDm = async (id: number) =>
    {
        setCloseError(null);

        try
        {
            await dispatch(leaveConversation(id)).unwrap();

            if (id === conversationId)
            {
                navigate('/channels/@me', { replace: true });
            }
        }
        catch (error)
        {
            setCloseError(getErrorMessage(error, 'Could not close conversation'));
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b pr-2 pl-4">
                <h2 className="truncate text-sm font-semibold">Direct Messages</h2>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="New message" onClick={() => setIsNewOpen(true)}>
                            <Plus aria-hidden="true" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">New message</TooltipContent>
                </Tooltip>
            </header>

            {closeError && <p role="alert" className="px-4 pt-2 text-sm text-destructive">{closeError}</p>}

            <ScrollArea className="min-h-0 flex-1">
                <nav aria-label="Direct messages" className="flex flex-col gap-0.5 py-3">
                    {
                        conversations.length > 0
                            ? conversations.map(conversation => (
                                <ConversationItem
                                    key={conversation.id}
                                    conversation={conversation}
                                    isActive={conversation.id === conversationId}
                                    onClose={handleCloseDm}
                                    onOpenSettings={setSettingsConversationId}
                                />
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

            <NewConversationDialog open={isNewOpen} onOpenChange={setIsNewOpen} />
            {
                settingsConversation && (
                    <GroupSettingsDialog
                        conversation={settingsConversation}
                        isActive={settingsConversation.id === conversationId}
                        open
                        onOpenChange={open => { if (!open) setSettingsConversationId(null); }}
                    />
                )
            }
        </div>
    );
};

export default ConversationList;
