import type { MessageResponse } from '@/types';
import { isSameDay } from '@/lib/messageTime';

export interface BlockedRuns
{
    // each blocked message's id, mapped to the id of the first message in its run
    runStartById: Map<number, number>;
    // the first message's id, mapped to every message id in that run
    runIdsByStart: Map<number, number[]>;
}

// back-to-back messages from blocked users collapse into one "N blocked messages" row; a new day starts a new run so its divider still shows
export const getBlockedRuns = (messages: MessageResponse[], blockedUsernames: Set<string>): BlockedRuns =>
{
    const runStartById = new Map<number, number>();
    const runIdsByStart = new Map<number, number[]>();
    let currentStartId: number | null = null;
    let previous: MessageResponse | undefined;

    for (const message of messages)
    {
        if (!blockedUsernames.has(message.senderUsername))
        {
            currentStartId = null;
        }
        else
        {
            const continuesRun = previous !== undefined && isSameDay(new Date(previous.timeSent), new Date(message.timeSent));
            const runStartId: number = continuesRun && currentStartId !== null ? currentStartId : message.id;

            if (runStartId === message.id)
            {
                runIdsByStart.set(message.id, []);
            }

            runStartById.set(message.id, runStartId);
            runIdsByStart.get(runStartId)?.push(message.id);
            currentStartId = runStartId;
        }

        previous = message;
    }

    return { runStartById, runIdsByStart };
};
