import type { ReactNode } from 'react';
import type { TypingUser } from './messageSource';

const MAX_NAMED = 3;

const describeTyping = (typingUsers: TypingUser[]): ReactNode =>
{
    if (typingUsers.length > MAX_NAMED)
    {
        return 'Several people are typing…';
    }

    const names = typingUsers.map(user => <strong key={user.username} className="font-semibold text-foreground">{user.displayName}</strong>);

    if (names.length === 1)
    {
        return <>{names[0]} is typing…</>;
    }

    if (names.length === 2)
    {
        return <>{names[0]} and {names[1]} are typing…</>;
    }

    return <>{names[0]}, {names[1]} and {names[2]} are typing…</>;
};

// not a live region, since announcing every change would be noisy for screen reader users
const TypingIndicator = ({ typingUsers }: { typingUsers: TypingUser[] }) =>
{
    if (typingUsers.length === 0)
    {
        return null;
    }

    return <p className="truncate text-xs text-muted-foreground">{describeTyping(typingUsers)}</p>;
};

export default TypingIndicator;
