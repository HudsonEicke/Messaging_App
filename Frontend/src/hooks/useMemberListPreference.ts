import { useState } from 'react';

const SHOW_MEMBER_LIST_KEY = 'showMemberList';

const loadPreference = (): boolean =>
{
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
        savePreference(nextIsOpen);
    };

    return { isOpen, toggle };
};
