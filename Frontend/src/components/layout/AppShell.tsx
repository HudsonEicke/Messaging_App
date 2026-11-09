import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Outlet } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AppDispatch } from '@/store/store';
import { fetchMe } from '@/store/userSlice';
import { useActiveIds } from '@/hooks/useActiveIds';
import ChannelList from '@/components/channel/ChannelList';
import ConversationList from '@/components/conversation/ConversationList';
import ServerList from '@/components/server/ServerList';
import UserPanel from './UserPanel';

const AppShell = () =>
{
    const dispatch = useDispatch<AppDispatch>();
    const { serverId } = useActiveIds();

    useEffect(() => { dispatch(fetchMe()); }, [dispatch]);

    return (
        <div className="flex h-screen overflow-hidden">
            <nav aria-label="Servers" className="flex w-14 shrink-0 flex-col bg-sidebar">
                <ScrollArea className="min-h-0 flex-1">
                    <ServerList />
                </ScrollArea>
            </nav>

            <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
                {
                    serverId !== null
                        ? <ChannelList serverId={serverId} />
                        : <ConversationList />
                }

                <UserPanel />
            </aside>

            <main className="flex min-w-0 flex-1 flex-col">
                <Outlet />
            </main>
        </div>
    );
};

export default AppShell;
