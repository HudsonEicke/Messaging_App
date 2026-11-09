import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { Hash } from 'lucide-react';
import type { ChannelResponse } from '@/types';
import type { RootState } from '@/store/store';
import { useActiveIds } from '@/hooks/useActiveIds';
import { useChannelMessages } from '@/hooks/useChannelMessages';
import ChatHeader from '@/components/message/ChatHeader';
import MessageView from '@/components/message/MessageView';

export const ChannelPage = () =>
{
    const { serverId, channelId } = useActiveIds();
    const channels = useSelector((state: RootState) => serverId === null ? undefined : state.server.channelsByServer[serverId]);
    const channel = channels?.find(listedChannel => listedChannel.channelID === channelId);

    if (serverId === null)
    {
        return <Navigate to="/channels/@me" replace />;
    }

    if (channels === undefined)
    {
        return null;
    }

    // deleted, or a bad link: the server page picks another channel
    if (channel === undefined)
    {
        return <Navigate to={`/channels/${serverId}`} replace />;
    }

    return <ChannelChat key={channel.channelID} serverId={serverId} channel={channel} />;
};

const ChannelChat = ({ serverId, channel }: { serverId: number; channel: ChannelResponse }) =>
{
    const currentUsername = useSelector((state: RootState) => state.user.user?.username);
    const isOwner = useSelector((state: RootState) =>
        currentUsername !== undefined && state.server.servers.some(server => server.serverID === serverId && server.ownerUsername === currentUsername)
    );
    const source = useChannelMessages(channel.channelID, channel.hasUnread, isOwner);

    return (
        // a row so the member list can sit on the right
        <div className="flex min-h-0 flex-1">
            <section aria-label={`#${channel.channelName}`} className="flex min-w-0 flex-1 flex-col">
                <ChatHeader icon={<Hash className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />} title={channel.channelName} />
                <MessageView
                    source={source}
                    placeholder={`Message #${channel.channelName}`}
                    intro={
                        <>
                            <p className="text-2xl font-bold">Welcome to #{channel.channelName}</p>
                            <p className="text-sm text-muted-foreground">This is the start of the #{channel.channelName} channel.</p>
                        </>
                    }
                />
            </section>
        </div>
    );
};
