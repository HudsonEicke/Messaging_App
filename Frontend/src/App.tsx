import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import AppShell from './components/layout/AppShell';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { ServerIndexPage } from '@/pages/server';

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
                        <Route path="/channels/@me" element={<div>home</div>} />
                        <Route path="/channels/@me/:conversationId" element={<div>conversation</div>} />
                        <Route path="/channels/:serverId" element={<ServerIndexPage />} />
                        <Route path="/channels/:serverId/:channelId" element={<div>channel</div>} />
                    </Route>
                </Route>
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
