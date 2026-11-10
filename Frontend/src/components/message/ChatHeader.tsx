import type { ReactNode } from 'react';

interface ChatHeaderProps
{
    icon: ReactNode;
    title: string;
    actions?: ReactNode;
}

const ChatHeader = ({ icon, title, actions }: ChatHeaderProps) =>
{
    return (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            {icon}
            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
            {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
    );
};

export default ChatHeader;
