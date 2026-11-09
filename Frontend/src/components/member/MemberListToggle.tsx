import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MemberListToggleProps
{
    isOpen: boolean;
    onToggle: () => void;
}

const MemberListToggle = ({ isOpen, onToggle }: MemberListToggleProps) =>
{
    const label = isOpen ? 'Hide member list' : 'Show member list';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Member list"
                    aria-pressed={isOpen}
                    onClick={onToggle}
                    className={cn(isOpen ? 'text-foreground' : 'text-muted-foreground')}
                >
                    <Users aria-hidden="true" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
        </Tooltip>
    );
};

export default MemberListToggle;
