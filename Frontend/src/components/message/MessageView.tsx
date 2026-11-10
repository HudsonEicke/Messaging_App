import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import type { MessageResponse } from '@/types';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import type { MessageSource } from './messageSource';
import MessageComposer from './MessageComposer';
import MessageList from './MessageList';

interface MessageViewProps
{
    source: MessageSource;
    placeholder: string;
    intro: ReactNode;
    // shown instead of the composer when you can't send, e.g. a DM with someone you've blocked
    composerNotice?: ReactNode;
}

const MessageView = ({ source, placeholder, intro, composerNotice }: MessageViewProps) =>
{
    const currentUsername = useSelector((state: RootState) => state.user.user?.username);
    const [replyTarget, setReplyTarget] = useState<MessageResponse | null>(null);
    const { send } = source;
    const replyToID = replyTarget?.id;

    const handleSend = useCallback(async (messageText: string) =>
    {
        await send(messageText, replyToID);
        setReplyTarget(null);
    }, [send, replyToID]);

    const cancelReply = useCallback(() => setReplyTarget(null), []);

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <MessageList source={source} currentUsername={currentUsername} intro={intro} onReply={setReplyTarget} />
            {
                composerNotice ?? (
                    <MessageComposer placeholder={placeholder} replyTarget={replyTarget} onCancelReply={cancelReply} onSend={handleSend} typingUsers={source.typingUsers} onTyping={source.notifyTyping} />
                )
            }
        </div>
    );
};

export default MessageView;
