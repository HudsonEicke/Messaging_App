import { z } from 'zod';
import { isWebUrl } from '@/lib/url';
import { SERVER_NAME_MAX_LENGTH } from './CreateServerForm.schema';

// matches UpdateServerRequest on the backend
export const SERVER_ICON_URL_MAX_LENGTH = 2048;

export const serverOverviewSchema = z.object({
    // the backend ignores a blank name, so it's required here
    serverName: z.string().trim().min(1, 'Server name is required').max(SERVER_NAME_MAX_LENGTH, `Server name must be ${SERVER_NAME_MAX_LENGTH} characters or fewer`),
    // empty removes the icon
    iconUrl: z.string()
        .trim()
        .max(SERVER_ICON_URL_MAX_LENGTH, `Icon URL must be ${SERVER_ICON_URL_MAX_LENGTH} characters or fewer`)
        .refine(value => value === '' || isWebUrl(value), 'Enter a valid http or https URL')
});

export type ServerOverviewFormValues = z.infer<typeof serverOverviewSchema>;
