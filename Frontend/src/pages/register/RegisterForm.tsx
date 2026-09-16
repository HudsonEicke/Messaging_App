import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { registerSchema } from "./RegisterForm.schema";
import type { RegisterFormValues } from "./RegisterForm.schema";

export const RegisterForm = () =>
{
    const navigate = useNavigate();
    const { register: registerUser } = useAuth();
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema)
    });

    const onSubmit = async (values: RegisterFormValues) =>
    {
        setServerError(null);

        try
        {
            const { confirmPassword, ...request } = values;
            await registerUser(request);
            navigate("/chat");
        }
        catch (err)
        {
            const message = typeof err === "string" ? err : "Could not create account";
            const lowerMessage = message.toLowerCase();
            const usernameTaken = lowerMessage.includes("username");
            const emailTaken = lowerMessage.includes("email");

            if (usernameTaken && emailTaken)
            {
                setError("username", { type: "server", message: "Username already in use" });
                setError("email", { type: "server", message: "Email already in use" });
            }
            else if (usernameTaken)
            {
                setError("username", { type: "server", message });
            }
            else if (emailTaken)
            {
                setError("email", { type: "server", message });
            }
            else
            {
                setServerError(message);
            }
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
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" placeholder="example@email.com" autoComplete="email" aria-invalid={!!errors.email} {...register("email")}/>
                        {errors.email && (
                            <p className="text-sm text-destructive">{errors.email.message}</p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")}/>
                        {errors.password && (
                            <p className="text-sm text-destructive">{errors.password.message}</p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")}/>
                        {errors.confirmPassword && (
                            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                        )}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex-col gap-2">
                {serverError && <p className="text-sm text-destructive">{serverError}</p>}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Signing up..." : "Sign up"}
                </Button>
                <p className="text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link to="/login" className="underline underline-offset-4 hover:underline">
                        Login
                    </Link>
                </p>
            </CardFooter>
        </form>
    )
}
