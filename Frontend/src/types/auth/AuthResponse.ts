export interface AuthResponse
{
    success: boolean;
    message: string;
    refreshToken: string;
    accessToken: string;
}