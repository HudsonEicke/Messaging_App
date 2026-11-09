import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store/store';
import { deleteMessage, editMessage, fetchMessages, markChannelRead, sendMessage } from '@/store/channelSlice';
import type { MessageSource } from '@/components/message/messageSource';

export const useChannelMessages = (channelID: number, hasUnread: boolean, canDeleteOthers: boolean): MessageSource =>
{
    const dispatch = useDispatch<AppDispatch>();
    const messages = useSelector((state: RootState) => state.channel.messagesByChannel[channelID]);
    const status = useSelector((state: RootState) => state.channel.messagesStatusByChannel[channelID] ?? 'idle');
    const error = useSelector((state: RootState) => state.channel.messagesErrorByChannel[channelID] ?? null);
    const hasMore = useSelector((state: RootState) => state.channel.hasMoreMessages[channelID] ?? false);
    const oldestMessageID = messages?.[0]?.id;

    const reload = useCallback(() =>
    {
        dispatch(fetchMessages({ channelID }));
    }, [dispatch, channelID]);

    // nothing pushes new messages until SignalR, so get the newest page every time the channel opens
    useEffect(() =>
    {
        reload();
    }, [reload]);

    const loadOlder = useCallback(() =>
    {
        if (oldestMessageID !== undefined)
        {
            dispatch(fetchMessages({ channelID, before: oldestMessageID }));
        }
    }, [dispatch, channelID, oldestMessageID]);

    const send = useCallback(async (messageText: string) =>
    {
        await dispatch(sendMessage({ channelID, request: { messageText } })).unwrap();
    }, [dispatch, channelID]);

    const edit = useCallback(async (messageID: number, messageText: string) =>
    {
        await dispatch(editMessage({ channelID, messageID, messageText })).unwrap();
    }, [dispatch, channelID]);

    const remove = useCallback(async (messageID: number) =>
    {
        await dispatch(deleteMessage({ channelID, messageID })).unwrap();
    }, [dispatch, channelID]);

    const markRead = useCallback((messageID: number) =>
    {
        dispatch(markChannelRead({ channelID, lastReadMessageID: messageID }));
    }, [dispatch, channelID]);

    return useMemo(
        () => ({ messages, status, error, hasMore, hasUnread, canDeleteOthers, reload, loadOlder, send, edit, remove, markRead }),
        [messages, status, error, hasMore, hasUnread, canDeleteOthers, reload, loadOlder, send, edit, remove, markRead]
    );
};
