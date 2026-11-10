import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { User } from 'lucide-react';
import type { UserDetailedResponse } from '@/types';
import { ActivityStatus } from '@/types';
import type { AppDispatch } from '@/store/store';
import { updateMyStatus } from '@/store/userSlice';
import { activityStatusDisplay } from '@/lib/activityStatus';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import StatusBadge from './StatusBadge';

interface StatusOption
{
    status: ActivityStatus;
    label: string;
    description?: string;
}

const STATUS_OPTIONS: StatusOption[] = [
    { status: ActivityStatus.online, label: activityStatusDisplay[ActivityStatus.online].label },
    { status: ActivityStatus.away, label: activityStatusDisplay[ActivityStatus.away].label },
    { status: ActivityStatus.dnd, label: activityStatusDisplay[ActivityStatus.dnd].label },
    { status: ActivityStatus.offline, label: 'Invisible', description: "You'll appear offline" }
];

const StatusPicker = ({ user }: { user: UserDetailedResponse }) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const [hasError, setHasError] = useState(false);

    const currentOption = STATUS_OPTIONS.find(option => option.status === user.activityStatus);

    const handleOpenChange = (open: boolean) =>
    {
        if (open)
        {
            setHasError(false);
        }
    };

    const handleValueChange = async (value: string) =>
    {
        const selectedOption = STATUS_OPTIONS.find(option => String(option.status) === value);

        if (selectedOption === undefined || selectedOption.status === user.activityStatus)
        {
            return;
        }

        try
        {
            await dispatch(updateMyStatus(selectedOption.status)).unwrap();
        }
        catch
        {
            setHasError(true);
        }
    };

    return (
        <DropdownMenu onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`Set status (currently ${currentOption?.label ?? 'unknown'})`}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left outline-none transition-colors hover:bg-sidebar-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-sidebar-accent/50"
                >
                    <Avatar>
                        <AvatarImage src={user.profileImageUrl} alt="" />
                        <AvatarFallback><User /></AvatarFallback>
                        <StatusBadge status={user.activityStatus} />
                    </Avatar>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{user.displayName}</p>
                        {
                            hasError
                                ? <p role="alert" className="truncate text-xs text-destructive">Couldn't change status</p>
                                : <p className="truncate text-xs text-muted-foreground">{user.username}</p>
                        }
                    </div>
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel>Set status</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={String(user.activityStatus)} onValueChange={handleValueChange}>
                    {
                        STATUS_OPTIONS.map(option =>
                        {
                            const { Icon, filled, color } = activityStatusDisplay[option.status];

                            return (
                                <DropdownMenuRadioItem key={option.status} value={String(option.status)} className="items-start">
                                    <Icon size={14} strokeWidth={2} fill={filled ? 'currentColor' : 'none'} style={{ color }} className="mt-0.5" aria-hidden="true" />
                                    <div className="min-w-0">
                                        <p>{option.label}</p>
                                        {option.description && <p className="text-xs text-muted-foreground">{option.description}</p>}
                                    </div>
                                </DropdownMenuRadioItem>
                            );
                        })
                    }
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default StatusPicker;
