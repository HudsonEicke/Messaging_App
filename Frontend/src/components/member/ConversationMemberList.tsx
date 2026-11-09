import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store/store';
import { fetchMembers } from '@/store/conversationSlice';
import { getErrorMessage } from '@/lib/utils';
import { useOnReconnect } from '@/hooks/useOnReconnect';
import MemberList from './MemberList';

interface ConversationMemberListProps
{
    conversationId: number;
    ownerUsername: string | undefined;
}

const ConversationMemberList = ({ conversationId, ownerUsername }: ConversationMemberListProps) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const members = useSelector((state: RootState) => state.conversation.membersByConversation[conversationId]);
    const [loadError, setLoadError] = useState<string | null>(null);

    // refetched on every open since nothing pushes status changes until SignalR
    const fetchList = useCallback(() =>
    {
        dispatch(fetchMembers(conversationId))
            .unwrap()
            .catch(error => setLoadError(getErrorMessage(error, 'Could not load members')));
    }, [dispatch, conversationId]);

    useEffect(() =>
    {
        fetchList();
    }, [fetchList]);

    useOnReconnect(fetchList);

    const handleRetry = () =>
    {
        setLoadError(null);
        fetchList();
    };

    return <MemberList members={members} ownerUsername={ownerUsername} loadError={loadError} onRetry={handleRetry} />;
};

export default ConversationMemberList;
