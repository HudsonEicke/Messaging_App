import { z } from 'zod';

export const GROUP_NAME_MAX_LENGTH = 100;
export const ICON_URL_MAX_LENGTH = 2048;
export const USERNAME_MAX_LENGTH = 32;

export const groupDetailsSchema = z.object({
    conversationName: z.string().trim().min(1, 'Group name is required').max(GROUP_NAME_MAX_LENGTH, `Group name must be ${GROUP_NAME_MAX_LENGTH} characters or fewer`),
    // empty clears the icon
    iconUrl: z.string().trim().max(ICON_URL_MAX_LENGTH, `Icon URL must be ${ICON_URL_MAX_LENGTH} characters or fewer`).refine(value => value === '' || URL.canParse(value), 'Enter a valid URL')
});

export type GroupDetailsFormValues = z.infer<typeof groupDetailsSchema>;

export const addMemberSchema = z.object({
    username: z.string().trim().min(1, 'Username is required').max(USERNAME_MAX_LENGTH, `Usernames are ${USERNAME_MAX_LENGTH} characters or fewer`)
});

export type AddMemberFormValues = z.infer<typeof addMemberSchema>;
