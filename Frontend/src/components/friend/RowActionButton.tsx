import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface RowActionButtonProps
{
    label: string;
    Icon: LucideIcon;
    onClick: () => void;
    disabled?: boolean;
    isDestructive?: boolean;
}

const RowActionButton = ({ label, Icon, onClick, disabled = false, isDestructive = false }: RowActionButtonProps) =>
{
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label}
                    disabled={disabled}
                    onClick={onClick}
                    className={isDestructive ? 'hover:text-destructive' : undefined}
                >
                    <Icon aria-hidden="true" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
    );
};

export default RowActionButton;
