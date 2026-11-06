import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import type { RootState } from '@/store/store';
import { useActiveIds } from '@/hooks/useActiveIds';

export const ServerIndexPage = () =>
{
    const { serverId } = useActiveIds();
    const serversStatus = useSelector((state: RootState) => state.server.serversStatus);
    const isMember = useSelector((state: RootState) => state.server.servers.some(listedServer => listedServer.serverID === serverId));
    const channels = useSelector((state: RootState) => serverId === null ? undefined : state.server.channelsByServer[serverId]);
    const lastChannelId = useSelector((state: RootState) => serverId === null ? undefined : state.server.lastChannelByServer[serverId]);

    if (serverId === null || (serversStatus === 'succeeded' && !isMember))
    {
        return <Navigate to="/channels/@me" replace />;
    }

    if (channels === undefined)
    {
        return null;
    }

    if (channels.length > 0)
    {
        // go back to the channel you were last in, unless it's been deleted since;
        // otherwise the first one, since channels come back sorted by channelOrder
        const targetChannel = channels.find(channel => channel.channelID === lastChannelId) ?? channels[0];

        return <Navigate to={`/channels/${serverId}/${targetChannel.channelID}`} replace />;
    }

    return (
        <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">No channels yet</p>
        </div>
    );
};
