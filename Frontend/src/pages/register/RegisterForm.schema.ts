import { z } from "zod";

export const registerSchema = z.object({
    username: z.string().min(1, "Username is required").max(32, "Username must be 32 characters or fewer"),
    email: z.email("Enter a valid email address").max(254, "Email must be 254 characters or fewer"),
    password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be 128 characters or fewer"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
