import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import AppShell from './components/layout/AppShell';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { ServerIndexPage } from '@/pages/server';
import { ChannelPage } from '@/pages/channel';
import { ConversationPage } from '@/pages/conversation';
import { FriendsPage } from '@/pages/friends';

function App()
{
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<GuestRoute />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                </Route>
                <Route element={<ProtectedRoute />}>
                    <Route element={<AppShell />}>
                        <Route path="/channels/@me" element={<FriendsPage />} />
                        <Route path="/channels/@me/:conversationId" element={<ConversationPage />} />
                        <Route path="/channels/:serverId" element={<ServerIndexPage />} />
                        <Route path="/channels/:serverId/:channelId" element={<ChannelPage />} />
                    </Route>
                </Route>
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
