import { useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

// hidden until clicked, then stays shown; links inside can't be followed until it's revealed
const Spoiler = ({ children }: { children: ReactNode }) =>
{
    const [isRevealed, setIsRevealed] = useState(false);

    if (isRevealed)
    {
        return <span className="rounded-sm bg-muted px-0.5">{children}</span>;
    }

    const reveal = (event: MouseEvent | KeyboardEvent) =>
    {
        // keeps the click or key from reaching the message row
        event.stopPropagation();
        event.preventDefault();
        setIsRevealed(true);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) =>
    {
        if (event.key === 'Enter' || event.key === ' ')
        {
            reveal(event);
        }
    };

    return (
        <span
            role="button"
            tabIndex={0}
            aria-label="Spoiler, press to reveal"
            onClick={reveal}
            onKeyDown={handleKeyDown}
            className="cursor-pointer rounded-sm bg-foreground px-0.5 text-transparent outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_*]:pointer-events-none [&_*]:text-transparent"
        >
            <span aria-hidden="true">{children}</span>
        </span>
    );
};

export default Spoiler;
