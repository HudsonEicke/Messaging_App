import { z } from 'zod';

export const SERVER_NAME_MAX_LENGTH = 100;

export const createServerSchema = z.object({
    serverName: z.string().trim().min(1, 'Server name is required').max(SERVER_NAME_MAX_LENGTH, `Server name must be ${SERVER_NAME_MAX_LENGTH} characters or fewer`)
});

export type CreateServerFormValues = z.infer<typeof createServerSchema>;
