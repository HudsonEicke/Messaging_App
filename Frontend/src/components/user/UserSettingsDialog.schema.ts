import { z } from 'zod';

// match the limits on UpdateMeRequest and UpdatePasswordRequest
export const DISPLAY_NAME_MAX_LENGTH = 32;
export const PROFILE_IMAGE_URL_MAX_LENGTH = 2048;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const isWebUrl = (value: string) => URL.canParse(value) && ['http:', 'https:'].includes(new URL(value).protocol);

export const profileSchema = z.object({
    // empty resets the display name to the username
    displayName: z.string().trim().max(DISPLAY_NAME_MAX_LENGTH, `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`),
    // empty removes the avatar
    profileImageUrl: z.string()
        .trim()
        .max(PROFILE_IMAGE_URL_MAX_LENGTH, `Avatar URL must be ${PROFILE_IMAGE_URL_MAX_LENGTH} characters or fewer`)
        .refine(value => value === '' || isWebUrl(value), 'Enter a valid http or https URL')
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const passwordSchema = z.object({
    currentPassword: z.string().min(1, 'Enter your current password').max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`),
    newPassword: z.string()
        .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
        .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`),
    confirmPassword: z.string().min(1, 'Confirm your new password')
})
    .refine(values => values.newPassword === values.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] })
    .refine(values => values.newPassword !== values.currentPassword, { message: 'New password must be different from your current one', path: ['newPassword'] });

export type PasswordFormValues = z.infer<typeof passwordSchema>;

export const isValidAvatarUrl = (value: string) => value !== '' && isWebUrl(value);
