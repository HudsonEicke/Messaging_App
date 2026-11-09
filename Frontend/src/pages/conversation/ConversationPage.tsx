import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { User, Users } from 'lucide-react';
import type { ConversationResponse } from '@/types';
import { ConversationType } from '@/types';
import type { RootState } from '@/store/store';
import { useActiveIds } from '@/hooks/useActiveIds';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ChatHeader from '@/components/message/ChatHeader';
import MessageView from '@/components/message/MessageView';

export const ConversationPage = () =>
{
    const { conversationId } = useActiveIds();
    const conversationsStatus = useSelector((state: RootState) => state.conversation.conversationsStatus);
    const conversation = useSelector((state: RootState) => state.conversation.conversations.find(listedConversation => listedConversation.id === conversationId));

    if (conversation === undefined)
    {
        // left, or a bad link
        return conversationsStatus === 'succeeded' || conversationId === null ? <Navigate to="/channels/@me" replace /> : null;
    }

    return <ConversationChat key={conversation.id} conversation={conversation} />;
};

const ConversationChat = ({ conversation }: { conversation: ConversationResponse }) =>
{
    const currentUsername = useSelector((state: RootState) => state.user.user?.username);
    const isGroup = conversation.conversationType === ConversationType.group;
    const isOwner = currentUsername !== undefined && conversation.ownerUsername === currentUsername;
    const source = useConversationMessages(conversation.id, conversation.unreadCount > 0, isGroup && isOwner);
    const FallbackIcon = isGroup ? Users : User;
    const name = conversation.conversationName;

    return (
        // a row so the member list can sit on the right
        <div className="flex min-h-0 flex-1">
            <section aria-label={name} className="flex min-w-0 flex-1 flex-col">
                <ChatHeader
                    icon={
                        <Avatar className="size-6">
                            <AvatarImage src={conversation.iconUrl} alt="" />
                            <AvatarFallback><FallbackIcon className="size-3.5" aria-hidden="true" /></AvatarFallback>
                        </Avatar>
                    }
                    title={name}
                />
                <MessageView
                    source={source}
                    placeholder={isGroup ? `Message ${name}` : `Message @${name}`}
                    intro={
                        <>
                            <p className="text-2xl font-bold">{name}</p>
                            <p className="text-sm text-muted-foreground">
                                {isGroup ? `This is the beginning of ${name}.` : `This is the beginning of your conversation with ${name}.`}
                            </p>
                        </>
                    }
                />
            </section>
        </div>
    );
};
