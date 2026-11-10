import type { MessageResponse } from '@/types';
import type { ApiError } from '@/lib/utils';

export const MESSAGE_MAX_LENGTH = 2000;

export const getMessageElementId = (messageID: number) => `message-${messageID}`;

export type MessagesStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface TypingUser
{
    username: string;
    displayName: string;
}

// what MessageView needs from a channel or a conversation, so the UI is written once
export interface MessageSource
{
    messages: MessageResponse[] | undefined;
    status: MessagesStatus;
    error: ApiError | null;
    hasMore: boolean;
    hasUnread: boolean;
    canDeleteOthers: boolean;
    reload: () => void;
    loadOlder: () => void;
    send: (messageText: string, replyToID?: number) => Promise<void>;
    edit: (messageID: number, messageText: string) => Promise<void>;
    remove: (messageID: number) => Promise<void>;
    markRead: (messageID: number) => void;
    // true while the list is at the bottom with the window focused, so new messages count as read on arrival
    setReading: (isReading: boolean) => void;
    // loads older pages until the message is in the list; false if it's gone
    ensureLoaded: (messageID: number) => Promise<boolean>;
    typingUsers: TypingUser[];
    notifyTyping: () => void;
}
