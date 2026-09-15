import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { loginSchema } from "./LoginForm.schema";
import type { LoginFormValues } from "./LoginForm.schema";

export const LoginForm = () =>
{
    const navigate = useNavigate();
    const { login } = useAuth();
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema)
    });

    const onSubmit = async (values: LoginFormValues) =>
    {
        setServerError(null);

        try
        {
            await login(values);
            navigate("/chat");
        }
        catch
        {
            setServerError("Invalid username or password");
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-(--card-spacing)">
            <CardContent>
                <div className="flex flex-col gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" type="text" autoComplete="username" aria-invalid={!!errors.username} {...register("username")}/>
                        {errors.username && (
                            <p className="text-sm text-destructive">{errors.username.message}</p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")}/>
                        {errors.password && (
                            <p className="text-sm text-destructive">{errors.password.message}</p>
                        )}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex-col gap-2">
                {serverError && <p className="text-sm text text-destructive">{serverError}</p>}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Signing in..." : "Login"}
                </Button>
                <p className="text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <Link to="/register" className="underline underline-offset-4 hover:underline">
                        Sign up
                    </Link>
                </p>
            </CardFooter>
        </form>
    )
}