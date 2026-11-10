import { z } from 'zod';

// matches SendFriendRequestRequest's MaxLength on the backend
const MAX_USERNAME_LENGTH = 32;

export const addFriendSchema = z.object({
    username: z.string()
        .trim()
        .min(1, 'Enter a username')
        .max(MAX_USERNAME_LENGTH, `Usernames are at most ${MAX_USERNAME_LENGTH} characters`)
});

export type AddFriendFormValues = z.infer<typeof addFriendSchema>;
