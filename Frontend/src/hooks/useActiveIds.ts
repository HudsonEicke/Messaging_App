import { useParams } from 'react-router-dom';

const paramToInt = (param: string | undefined): number | null =>
{
    if (param === undefined)
    {
        return null;
    }

    const paramInt = Number(param);

    if (!Number.isInteger(paramInt))
    {
        return null;
    }

    if (paramInt <= 0)
    {
        return null;
    }

    return paramInt;
};

export const useActiveIds = () =>
{
    const { serverId: stringServerId, channelId: stringChannelId, conversationId: stringConversationId } = useParams<'serverId' | 'channelId' | 'conversationId'>();
    
    const serverId = paramToInt(stringServerId);
    const channelId = paramToInt(stringChannelId);
    const conversationId = paramToInt(stringConversationId);

    return { serverId, channelId, conversationId };
};
