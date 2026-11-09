import type { ReactNode } from 'react';
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
}

const MessageView = ({ source, placeholder, intro }: MessageViewProps) =>
{
    const currentUsername = useSelector((state: RootState) => state.user.user?.username);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <MessageList source={source} currentUsername={currentUsername} intro={intro} />
            <MessageComposer placeholder={placeholder} onSend={source.send} />
        </div>
    );
};

export default MessageView;
