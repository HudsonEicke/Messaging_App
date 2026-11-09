const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const shortDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short' });
const longDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });
const fullFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' });

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export const isSameDay = (first: Date, second: Date): boolean =>
    first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();

const isYesterday = (date: Date): boolean =>
{
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return isSameDay(date, yesterday);
};

// "Today at 3:42 PM", "Yesterday at 3:42 PM" or "11/3/26, 3:42 PM"
export const formatMessageTimestamp = (date: Date): string =>
{
    const time = timeFormat.format(date);

    if (isSameDay(date, new Date()))
    {
        return `Today at ${time}`;
    }

    if (isYesterday(date))
    {
        return `Yesterday at ${time}`;
    }

    return `${shortDateFormat.format(date)}, ${time}`;
};

export const formatMessageTime = (date: Date): string => timeFormat.format(date);

export const formatDayDivider = (date: Date): string => longDateFormat.format(date);

export const formatFullTimestamp = (date: Date): string => fullFormat.format(date);

export const isWithinGroupWindow = (earlier: Date, later: Date): boolean => later.getTime() - earlier.getTime() < GROUP_WINDOW_MS;
