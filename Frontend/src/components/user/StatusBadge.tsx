import { cn } from '@/lib/utils';
import { activityStatusDisplay } from '@/lib/activityStatus';
import { ActivityStatus } from '@/types';

interface StatusBadgeProps
{
    status: ActivityStatus;
    className?: string;
}

// sits in the bottom-right of an Avatar; the disc and ring match bg-sidebar by default,
// so pass e.g. "bg-background ring-background" when it's on a different background
const StatusBadge = ({ status, className }: StatusBadgeProps) =>
{
    const { label, Icon, filled, color } = activityStatusDisplay[status] ?? activityStatusDisplay[ActivityStatus.offline];

    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className={cn('absolute -right-0.5 -bottom-0.5 z-10 flex size-3 items-center justify-center rounded-full bg-sidebar ring-2 ring-sidebar', className)}
            style={{ color }}
        >
            <Icon strokeWidth={2} className="size-full" fill={filled ? 'currentColor' : 'none'} aria-hidden="true" />
        </span>
    );
};

export default StatusBadge;
