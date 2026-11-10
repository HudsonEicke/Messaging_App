import { z } from 'zod';

const INVITE_CODE_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// codes are GUIDs, so this also accepts a pasted link or sentence that contains one
export const joinServerSchema = z.object({
    inviteCode: z.string()
        .trim()
        .min(1, 'Invite code is required')
        .regex(INVITE_CODE_PATTERN, 'Enter a valid invite code')
        .transform(value => value.match(INVITE_CODE_PATTERN)?.[0].toLowerCase() ?? value)
});

export type JoinServerFormValues = z.infer<typeof joinServerSchema>;
