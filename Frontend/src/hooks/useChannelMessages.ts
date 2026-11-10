import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import type { AppDispatch, RootState } from '@/store/store';
import { deleteMessage, editMessage, fetchMessages, markChannelRead, sendMessage } from '@/store/channelSlice';
import { startReadingChannel, stopReadingChannel } from '@/store/readingSlice';
import type { MessageSource } from '@/components/message/messageSource';
import { useOnReconnect } from './useOnReconnect';
import { useTyping } from './useTyping';

export const useChannelMessages = (channelID: number, hasUnread: boolean, canDeleteOthers: boolean): MessageSource =>
{
    const dispatch = useDispatch<AppDispatch>();
    const store = useStore<RootState>();
    const messages = useSelector((state: RootState) => state.channel.messagesByChannel[channelID]);
    const status = useSelector((state: RootState) => state.channel.messagesStatusByChannel[channelID] ?? 'idle');
    const error = useSelector((state: RootState) => state.channel.messagesErrorByChannel[channelID] ?? null);
    const hasMore = useSelector((state: RootState) => state.channel.hasMoreMessages[channelID] ?? false);
    const oldestMessageID = messages?.[0]?.id;
    const { typingUsers, notifyTyping, resetPing } = useTyping('channel', channelID);

    const reload = useCallback(() =>
    {
        dispatch(fetchMessages({ channelID }));
    }, [dispatch, channelID]);

    // the hub keeps a cached channel current, but not across a reconnect, so get the newest page every time the channel opens
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
            dispatch(fetchMessages({ channelID, before: oldestMessageID }));
        }
    }, [dispatch, channelID, oldestMessageID]);

    const send = useCallback(async (messageText: string, replyToID?: number) =>
    {
        await dispatch(sendMessage({ channelID, request: { messageText, replyToID } })).unwrap();
        resetPing();
    }, [dispatch, channelID, resetPing]);

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

    const setReading = useCallback((isReading: boolean) =>
    {
        dispatch(isReading ? startReadingChannel(channelID) : stopReadingChannel(channelID));
    }, [dispatch, channelID]);

    const ensureLoaded = useCallback(async (messageID: number): Promise<boolean> =>
    {
        for (;;)
        {
            const state = store.getState().channel;
            const loadedMessages = state.messagesByChannel[channelID] ?? [];

            if (loadedMessages.some(message => message.id === messageID))
            {
                return true;
            }

            // ids only go up, so a missing id newer than the oldest loaded one was deleted
            const oldestLoadedID = loadedMessages[0]?.id;

            if (oldestLoadedID === undefined || messageID > oldestLoadedID || !state.hasMoreMessages[channelID])
            {
                return false;
            }

            const result = await dispatch(fetchMessages({ channelID, before: oldestLoadedID }));

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
    }, [dispatch, store, channelID]);

    return useMemo(
        () => ({ messages, status, error, hasMore, hasUnread, canDeleteOthers, reload, loadOlder, send, edit, remove, markRead, setReading, ensureLoaded, typingUsers, notifyTyping }),
        [messages, status, error, hasMore, hasUnread, canDeleteOthers, reload, loadOlder, send, edit, remove, markRead, setReading, ensureLoaded, typingUsers, notifyTyping]
    );
};
