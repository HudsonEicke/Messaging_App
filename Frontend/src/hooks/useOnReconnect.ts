import { useEffect, useEffectEvent, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';

// runs onReconnect after each hub reconnect (not on mount) so the component can refetch what it missed
export const useOnReconnect = (onReconnect: () => void) =>
{
    const reconnectCount = useSelector((state: RootState) => state.hub.reconnectCount);
    const handledCount = useRef(reconnectCount);
    const handleReconnect = useEffectEvent(onReconnect);

    useEffect(() =>
    {
        if (reconnectCount !== handledCount.current)
        {
            handledCount.current = reconnectCount;
            handleReconnect();
        }
    }, [reconnectCount]);
};
