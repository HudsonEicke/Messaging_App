const LAST_CHANNELS_KEY = 'lastChannelByServer';

const isPositiveInteger = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

export const loadLastChannels = (): Record<number, number> =>
{
    try
    {
        const stored = localStorage.getItem(LAST_CHANNELS_KEY);

        if (stored === null)
        {
            return {};
        }

        const parsed: unknown = JSON.parse(stored);

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        {
            return {};
        }

        // JSON object keys are strings, so turn them back into server ids and drop anything that isn't a valid id pair
        const lastChannels: Record<number, number> = {};

        for (const [serverKey, channelID] of Object.entries(parsed))
        {
            const serverID = Number(serverKey);

            if (isPositiveInteger(serverID) && isPositiveInteger(channelID))
            {
                lastChannels[serverID] = channelID;
            }
        }

        return lastChannels;
    }
    catch
    {
        return {};
    }
};

export const saveLastChannels = (lastChannels: Record<number, number>) =>
{
    try
    {
        localStorage.setItem(LAST_CHANNELS_KEY, JSON.stringify(lastChannels));
    }
    catch
    {
        // not being able to remember the channel isn't worth surfacing to the user
    }
};

export const clearLastChannels = () =>
{
    try
    {
        localStorage.removeItem(LAST_CHANNELS_KEY);
    }
    catch
    {
        // nothing to clean up if storage isn't available
    }
};
