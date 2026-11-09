import { z } from 'zod';

export const CHANNEL_NAME_MAX_LENGTH = 100;

export const channelNameSchema = z.object({
    channelName: z.string().trim().min(1, 'Channel name is required').max(CHANNEL_NAME_MAX_LENGTH, `Channel name must be ${CHANNEL_NAME_MAX_LENGTH} characters or fewer`)
});

export type ChannelNameFormValues = z.infer<typeof channelNameSchema>;
