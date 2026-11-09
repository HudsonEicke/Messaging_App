import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) =>
{
    window.addEventListener('focus', onChange);
    window.addEventListener('blur', onChange);

    return () =>
    {
        window.removeEventListener('focus', onChange);
        window.removeEventListener('blur', onChange);
    };
};

const getSnapshot = () => document.hasFocus();

export const useWindowFocus = (): boolean => useSyncExternalStore(subscribe, getSnapshot);
