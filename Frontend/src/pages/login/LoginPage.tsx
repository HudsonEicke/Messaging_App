import { Card, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import { LoginForm } from "./LoginForm";

export const LoginPage = () =>
{
    return (
        <div className="flex min-h-screen items-center justify-center px-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Login</CardTitle>
                    <CardDescription>Login to you account below</CardDescription>
                </CardHeader>
                <LoginForm/>
            </Card>
        </div>
    );
};

