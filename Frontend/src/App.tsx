import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute';

function App()
{
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<div>Login</div>} />
                <Route path="/register" element={<div>Register</div>} />
                <Route element={<ProtectedRoute />}>
                    <Route path="/chat" element={<div>Chat</div>} />
                </Route>
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
