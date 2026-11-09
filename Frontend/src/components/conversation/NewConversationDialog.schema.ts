import { z } from 'zod';

// the backend allows 25 members including you
export const MAX_OTHER_MEMBERS = 24;
export const USERNAME_MAX_LENGTH = 32;
export const GROUP_NAME_MAX_LENGTH = 100;

export const newConversationSchema = z.object({
    usernames: z.array(z.string()).min(1, 'Add at least one username').max(MAX_OTHER_MEMBERS, `You can add up to ${MAX_OTHER_MEMBERS} people`),
    groupName: z.string().trim().max(GROUP_NAME_MAX_LENGTH, `Group name must be ${GROUP_NAME_MAX_LENGTH} characters or fewer`)
});

export type NewConversationFormValues = z.infer<typeof newConversationSchema>;
