import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch } from '@/store/store';
import { createConversation, fetchConversations } from '@/store/conversationSlice';

// creating a DM that already exists returns the existing one; throws if the request fails
export const useOpenDirectMessage = () =>
{
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();

    return async (username: string) =>
    {
        const conversation = await dispatch(createConversation({ memberUsernames: [username] })).unwrap();
        dispatch(fetchConversations());
        navigate(`/channels/@me/${conversation.id}`);
    };
};
