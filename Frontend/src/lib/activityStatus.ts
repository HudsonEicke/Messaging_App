import { BellOff, Circle, MoonStar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ActivityStatus } from '@/types';
import { Zzz } from '@/components/icons/Zzz';

interface ActivityStatusDisplay
{
    label: string;
    Icon: LucideIcon;
    filled: boolean;
    colorClass: string;
}

// Record makes TypeScript error if a status is added to the enum without an entry here
export const activityStatusDisplay: Record<ActivityStatus, ActivityStatusDisplay> = {
    [ActivityStatus.online]: { label: 'Online', Icon: Circle, filled: true, colorClass: 'text-status-online' },
    [ActivityStatus.away]: { label: 'Away', Icon: MoonStar, filled: true, colorClass: 'text-status-away' },
    [ActivityStatus.dnd]: { label: 'Do not disturb', Icon: BellOff, filled: false, colorClass: 'text-status-dnd' },
    [ActivityStatus.offline]: { label: 'Offline', Icon: Zzz, filled: false, colorClass: 'text-status-offline' }
};
