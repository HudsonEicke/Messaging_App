import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import type { AppDispatch, RootState } from '@/store/store';
import { deleteMessage, editMessage, fetchMessages, markConversationRead, sendMessage } from '@/store/conversationSlice';
import type { MessageSource } from '@/components/message/messageSource';
import { useOnReconnect } from './useOnReconnect';

export const useConversationMessages = (conversationID: number, hasUnread: boolean, canDeleteOthers: boolean): MessageSource =>
{
    const dispatch = useDispatch<AppDispatch>();
    const store = useStore<RootState>();
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

    // replaces the loaded pages with the newest one, so a reader scrolled up into history lands back at the bottom
    useOnReconnect(reload);

    const loadOlder = useCallback(() =>
    {
        if (oldestMessageID !== undefined)
        {
            dispatch(fetchMessages({ conversationID, before: oldestMessageID }));
        }
    }, [dispatch, conversationID, oldestMessageID]);

    const send = useCallback(async (messageText: string, replyToID?: number) =>
    {
        await dispatch(sendMessage({ conversationID, request: { messageText, replyToID } })).unwrap();
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

    const ensureLoaded = useCallback(async (messageID: number): Promise<boolean> =>
    {
        for (;;)
        {
            const state = store.getState().conversation;
            const loadedMessages = state.messagesByConversation[conversationID] ?? [];

            if (loadedMessages.some(message => message.id === messageID))
            {
                return true;
            }

            // ids only go up, so a missing id newer than the oldest loaded one was deleted
            const oldestLoadedID = loadedMessages[0]?.id;

            if (oldestLoadedID === undefined || messageID > oldestLoadedID || !state.hasMoreMessages[conversationID])
            {
                return false;
            }

            const result = await dispatch(fetchMessages({ conversationID, before: oldestLoadedID }));

            if (fetchMessages.rejected.match(result))
            {
                // skipped because a page is already loading, so wait for it instead of failing
                if (result.meta.condition)
                {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }

                throw result.payload ?? new Error('Could not load messages');
            }
        }
    }, [dispatch, store, conversationID]);

    return useMemo(
        () => ({ messages, status, error, hasMore, hasUnread, canDeleteOthers, reload, loadOlder, send, edit, remove, markRead, ensureLoaded }),
        [messages, status, error, hasMore, hasUnread, canDeleteOthers, reload, loadOlder, send, edit, remove, markRead, ensureLoaded]
    );
};
