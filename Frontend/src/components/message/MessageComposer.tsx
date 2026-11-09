import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, SubmitEvent } from 'react';
import { cn, getErrorMessage } from '@/lib/utils';
import { MESSAGE_MAX_LENGTH } from './messageSource';

const COUNTER_THRESHOLD = 1800;

interface MessageComposerProps
{
    placeholder: string;
    onSend: (messageText: string) => Promise<void>;
}

const MessageComposer = ({ placeholder, onSend }: MessageComposerProps) =>
{
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [draft, setDraft] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    useEffect(() =>
    {
        textareaRef.current?.focus();
    }, []);

    const send = async () =>
    {
        const messageText = draft.trim();

        if (messageText === '' || isSending)
        {
            return;
        }

        setIsSending(true);
        setSendError(null);

        try
        {
            await onSend(messageText);
            setDraft('');
        }
        catch (error)
        {
            setSendError(getErrorMessage(error, 'Could not send message'));
        }
        finally
        {
            setIsSending(false);
        }
    };

    const handleSubmit = (event: SubmitEvent<HTMLFormElement>) =>
    {
        event.preventDefault();
        send();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) =>
    {
        // isComposing: Enter that confirms an IME candidate shouldn't send
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing)
        {
            event.preventDefault();
            send();
        }
    };

    const remaining = MESSAGE_MAX_LENGTH - draft.length;

    return (
        <form onSubmit={handleSubmit} className="shrink-0 px-4 pb-4">
            <div className="relative rounded-lg border border-input bg-muted/40 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={draft}
                    maxLength={MESSAGE_MAX_LENGTH}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    aria-invalid={sendError !== null}
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    className="block field-sizing-content max-h-[50vh] min-h-11 w-full resize-none bg-transparent py-3 pr-14 pl-4 text-sm outline-none placeholder:text-muted-foreground"
                />
                {
                    draft.length > COUNTER_THRESHOLD && (
                        <span
                            aria-live="polite"
                            className={cn('absolute right-3 bottom-3 text-xs tabular-nums', remaining <= 0 ? 'text-destructive' : 'text-muted-foreground')}
                        >
                            {remaining}
                            <span className="sr-only"> characters left</span>
                        </span>
                    )
                }
            </div>
            {sendError && <p role="alert" className="mt-1 text-sm text-destructive">{sendError}</p>}
        </form>
    );
};

export default MessageComposer;
