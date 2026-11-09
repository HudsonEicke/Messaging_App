import { BellOff, Circle, MoonStar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ActivityStatus } from '@/types';
import { Zzz } from '@/components/icons/Zzz';

interface ActivityStatusDisplay
{
    label: string;
    Icon: LucideIcon;
    filled: boolean;
    // a CSS colour rather than a class, so menus that recolour their contents on focus can't override it
    color: string;
}

// Record makes TypeScript error if a status is added to the enum without an entry here
export const activityStatusDisplay: Record<ActivityStatus, ActivityStatusDisplay> = {
    [ActivityStatus.online]: { label: 'Online', Icon: Circle, filled: true, color: 'var(--color-status-online)' },
    [ActivityStatus.away]: { label: 'Away', Icon: MoonStar, filled: true, color: 'var(--color-status-away)' },
    [ActivityStatus.dnd]: { label: 'Do not disturb', Icon: BellOff, filled: false, color: 'var(--color-status-dnd)' },
    [ActivityStatus.offline]: { label: 'Offline', Icon: Zzz, filled: false, color: 'var(--color-status-offline)' }
};
