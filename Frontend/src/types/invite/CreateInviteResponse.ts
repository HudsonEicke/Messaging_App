export interface CreateInviteResponse
{
    inviteCode: string;
    expiresDate?: string;
    maxUses?: number;
}