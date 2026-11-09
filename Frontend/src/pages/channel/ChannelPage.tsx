import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { Hash } from 'lucide-react';
import type { ChannelResponse } from '@/types';
import type { RootState } from '@/store/store';
import { useActiveIds } from '@/hooks/useActiveIds';
import { useChannelMessages } from '@/hooks/useChannelMessages';
import { useMemberListPreference } from '@/hooks/useMemberListPreference';
import ChannelIntro from '@/components/channel/ChannelIntro';
import ChatHeader from '@/components/message/ChatHeader';
import MemberListToggle from '@/components/member/MemberListToggle';
import ServerMemberList from '@/components/member/ServerMemberList';
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
    const ownerUsername = useSelector((state: RootState) => state.server.servers.find(server => server.serverID === serverId)?.ownerUsername);
    const isOwner = currentUsername !== undefined && ownerUsername === currentUsername;
    const source = useChannelMessages(channel.channelID, channel.hasUnread, isOwner);
    const memberList = useMemberListPreference();

    return (
        <section aria-label={`#${channel.channelName}`} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ChatHeader
                icon={<Hash className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                title={channel.channelName}
                actions={<MemberListToggle isOpen={memberList.isOpen} onToggle={memberList.toggle} />}
            />

            {/* the header spans the full width; the member list sits beside the messages under it */}
            <div className="relative flex min-h-0 flex-1">
                <MessageView
                    source={source}
                    placeholder={`Message #${channel.channelName}`}
                    intro={<ChannelIntro channelID={channel.channelID} channelName={channel.channelName} />}
                />

                {memberList.isOpen && <ServerMemberList serverId={serverId} ownerUsername={ownerUsername} />}
            </div>
        </section>
    );
};
