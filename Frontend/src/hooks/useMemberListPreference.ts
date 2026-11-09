import { useState } from 'react';

const SHOW_MEMBER_LIST_KEY = 'showMemberList';
const WIDE_SCREEN_QUERY = '(min-width: 1024px)';

const isWideScreen = (): boolean => window.matchMedia(WIDE_SCREEN_QUERY).matches;

// on narrow screens the list covers the messages, so it always starts closed there and toggling isn't saved
const loadPreference = (): boolean =>
{
    if (!isWideScreen())
    {
        return false;
    }

    try
    {
        return localStorage.getItem(SHOW_MEMBER_LIST_KEY) !== 'false';
    }
    catch
    {
        return true;
    }
};

const savePreference = (isOpen: boolean) =>
{
    try
    {
        localStorage.setItem(SHOW_MEMBER_LIST_KEY, String(isOpen));
    }
    catch
    {
        // storage can be blocked; the toggle still works for this visit
    }
};

export const useMemberListPreference = () =>
{
    const [isOpen, setIsOpen] = useState(loadPreference);

    const toggle = () =>
    {
        const nextIsOpen = !isOpen;
        setIsOpen(nextIsOpen);

        if (isWideScreen())
        {
            savePreference(nextIsOpen);
        }
    };

    return { isOpen, toggle };
};
