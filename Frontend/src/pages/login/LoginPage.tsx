import { Card, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import { LoginForm } from "./LoginForm";

export const LoginPage = () =>
{
    return (
        <div className="flex min-h-screen items-center justify-center px-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Login</CardTitle>
                    <CardDescription>Log in to your Beacon account</CardDescription>
                </CardHeader>
                <LoginForm/>
            </Card>
        </div>
    );
};

