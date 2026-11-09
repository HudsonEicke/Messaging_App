import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';

const ConnectionBanner = () =>
{
    const isReconnecting = useSelector((state: RootState) => state.hub.status === 'reconnecting');

    // the live region stays mounted so screen readers announce the text when it appears
    return (
        <div role="status">
            {
                isReconnecting && (
                    <p className="bg-status-away py-1 text-center text-sm font-medium text-black">
                        Connection lost. Reconnecting…
                    </p>
                )
            }
        </div>
    );
};

export default ConnectionBanner;
