import { NavLink } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface HomeButtonProps
{
    isActive: boolean;
}

// top of the server rail, opens the DM list; styled like ServerIcon so the rail reads as one list
const HomeButton = ({ isActive }: HomeButtonProps) =>
{
    return (
        <div className="group relative flex w-full justify-center">
            <span
                aria-hidden="true"
                className={cn(
                    'absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r-full bg-foreground transition-all',
                    isActive ? 'h-8' : 'h-0 group-hover:h-4'
                )}
            />

            <Tooltip>
                <TooltipTrigger asChild>
                    <NavLink
                        to="/channels/@me"
                        aria-label="Direct Messages"
                        // NavLink would only set this on exactly /channels/@me, not on /channels/@me/:conversationId
                        aria-current={isActive ? 'page' : undefined}
                        className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                        <div
                            className={cn(
                                // same rounding as ServerIcon: 20px is a full circle at size-10 and animates smoothly to xl
                                'flex size-10 items-center justify-center transition-all',
                                isActive
                                    ? 'rounded-xl bg-primary text-primary-foreground'
                                    : 'rounded-[20px] bg-muted text-muted-foreground group-hover:rounded-xl group-hover:bg-primary group-hover:text-primary-foreground'
                            )}
                        >
                            <MessageCircle className="size-5" aria-hidden="true" />
                        </div>
                    </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">Direct Messages</TooltipContent>
            </Tooltip>
        </div>
    );
};

export default HomeButton;
