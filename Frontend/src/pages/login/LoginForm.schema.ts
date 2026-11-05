import { z } from "zod";

export const loginSchema = z.object({
    username: z.string().min(1, 'Username is required').max(32, 'Username must be 32 characters or fewer'),
    password: z.string().min(1, 'Password is required').max(128, 'Password must be 128 characters or fewer')
});

export type LoginFormValues = z.infer<typeof loginSchema>;