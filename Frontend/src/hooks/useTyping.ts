import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { sendHubMessage, subscribeHubEvent } from '@/services/hub/connection';
import type { TypingUser } from '@/components/message/messageSource';

const PING_INTERVAL_MS = 5_000;
const TYPING_TIMEOUT_MS = 8_000;

interface TypingEntry extends TypingUser
{
    targetId: number;
    expiresAt: number;
}

// typing only sends start pings, so someone stops showing once their pings stop or their message arrives
export const useTyping = (kind: 'channel' | 'conversation', targetId: number) =>
{
    const currentUsername = useSelector((state: RootState) => state.user.user?.username);
    const [entries, setEntries] = useState<TypingEntry[]>([]);
    const lastPingRef = useRef(0);

    useEffect(() =>
    {
        const addTyper = (eventTargetId: number, username: string, displayName: string) =>
        {
            if (eventTargetId === targetId)
            {
                setEntries(current => [
                    ...current.filter(entry => entry.username !== username),
                    { targetId, username, displayName, expiresAt: Date.now() + TYPING_TIMEOUT_MS }
                ]);
            }
        };

        const removeTyper = (eventTargetId: number, username: string) =>
        {
            if (eventTargetId === targetId)
            {
                setEntries(current => current.filter(entry => entry.username !== username));
            }
        };

        const unsubscribers = kind === 'channel'
            ? [
                subscribeHubEvent('ChannelTyping', addTyper),
                subscribeHubEvent('ReceiveChannelMessage', (_serverID, channelID, message) => removeTyper(channelID, message.senderUsername))
            ]
            : [
                subscribeHubEvent('ConversationTyping', addTyper),
                subscribeHubEvent('ReceiveConversationMessage', (conversationID, message) => removeTyper(conversationID, message.senderUsername))
            ];

        return () => unsubscribers.forEach(unsubscribe => unsubscribe());
    }, [kind, targetId]);

    useEffect(() =>
    {
        if (entries.length === 0)
        {
            return;
        }

        const nextExpiry = Math.min(...entries.map(entry => entry.expiresAt));
        const timer = setTimeout(() => setEntries(current => current.filter(entry => entry.expiresAt > Date.now())), nextExpiry - Date.now());

        return () => clearTimeout(timer);
    }, [entries]);

    // your other tabs would otherwise show you typing
    const typingUsers = useMemo(
        () => entries
            .filter(entry => entry.targetId === targetId && entry.username !== currentUsername)
            .map(({ username, displayName }) => ({ username, displayName })),
        [entries, targetId, currentUsername]
    );

    const notifyTyping = useCallback(() =>
    {
        const now = Date.now();

        if (now - lastPingRef.current < PING_INTERVAL_MS)
        {
            return;
        }

        lastPingRef.current = now;

        if (kind === 'channel')
        {
            sendHubMessage('StartChannelTyping', targetId);
        }
        else
        {
            sendHubMessage('StartConversationTyping', targetId);
        }
    }, [kind, targetId]);

    // after a send, the next keystroke pings straight away since your message just cleared you for everyone
    const resetPing = useCallback(() =>
    {
        lastPingRef.current = 0;
    }, []);

    return { typingUsers, notifyTyping, resetPing };
};
