import { useCallback, useEffect, useRef } from 'react';

// dnd-kit only stops the click that ends a pointer drag from propagating, it doesn't cancel it,
// so a dragged link would still do a full page navigation; this cancels that one click
export const useSuppressClickAfterDrag = () =>
{
    const isSuppressingRef = useRef(false);

    useEffect(() =>
    {
        const cancelClick = (event: MouseEvent) =>
        {
            if (isSuppressingRef.current)
            {
                event.preventDefault();
                event.stopPropagation();
                isSuppressingRef.current = false;
            }
        };

        // window capture runs before dnd-kit's document listener and before the link
        window.addEventListener('click', cancelClick, { capture: true });

        return () => window.removeEventListener('click', cancelClick, { capture: true });
    }, []);

    const startSuppressing = useCallback(() =>
    {
        isSuppressingRef.current = true;
    }, []);

    // the click comes right after the drag ends, so wait a tick; a keyboard drag has no click and this clears it
    const stopSuppressing = useCallback(() =>
    {
        setTimeout(() =>
        {
            isSuppressingRef.current = false;
        }, 0);
    }, []);

    return { startSuppressing, stopSuppressing };
};
