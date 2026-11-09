import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store/store';
import { deleteMessage, editMessage, fetchMessages, markConversationRead, sendMessage } from '@/store/conversationSlice';
import type { MessageSource } from '@/components/message/messageSource';

export const useConversationMessages = (conversationID: number, hasUnread: boolean, canDeleteOthers: boolean): MessageSource =>
{
    const dispatch = useDispatch<AppDispatch>();
    const messages = useSelector((state: RootState) => state.conversation.messagesByConversation[conversationID]);
    const status = useSelector((state: RootState) => state.conversation.messagesStatusByConversation[conversationID] ?? 'idle');
    const error = useSelector((state: RootState) => state.conversation.messagesErrorByConversation[conversationID] ?? null);
    const hasMore = useSelector((state: RootState) => state.conversation.hasMoreMessages[conversationID] ?? false);
    const oldestMessageID = messages?.[0]?.id;

    const reload = useCallback(() =>
    {
        dispatch(fetchMessages({ conversationID }));
    }, [dispatch, conversationID]);

    // nothing pushes new messages until SignalR, so get the newest page every time the conversation opens
    useEffect(() =>
    {
        reload();
    }, [reload]);

    const loadOlder = useCallback(() =>
    {
        if (oldestMessageID !== undefined)
        {
            dispatch(fetchMessages({ conversationID, before: oldestMessageID }));
        }
    }, [dispatch, conversationID, oldestMessageID]);

    const send = useCallback(async (messageText: string) =>
    {
        await dispatch(sendMessage({ conversationID, request: { messageText } })).unwrap();
    }, [dispatch, conversationID]);

    const edit = useCallback(async (messageID: number, messageText: string) =>
    {
        await dispatch(editMessage({ conversationID, messageID, messageText })).unwrap();
    }, [dispatch, conversationID]);

    const remove = useCallback(async (messageID: number) =>
    {
        await dispatch(deleteMessage({ conversationID, messageID })).unwrap();
    }, [dispatch, conversationID]);

    const markRead = useCallback((messageID: number) =>
    {
        dispatch(markConversationRead({ conversationID, lastReadMessageID: messageID }));
    }, [dispatch, conversationID]);

    return useMemo(
        () => ({ messages, status, error, hasMore, hasUnread, canDeleteOthers, reload, loadOlder, send, edit, remove, markRead }),
        [messages, status, error, hasMore, hasUnread, canDeleteOthers, reload, loadOlder, send, edit, remove, markRead]
    );
};
