import { Card, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import { RegisterForm } from "./RegisterForm";

export const RegisterPage = () =>
{
    return (
        <div className="flex min-h-screen items-center justify-center px-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Create Account</CardTitle>
                    <CardDescription>Fill in the information below to create your account</CardDescription>
                </CardHeader>
                <RegisterForm/>
            </Card>
        </div>
    );
};

