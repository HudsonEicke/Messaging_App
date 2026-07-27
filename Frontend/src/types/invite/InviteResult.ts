export interface InviteResult
{
    inviteCode: string;
    createdByUsername: string;
    createdDate: string;
    expiresDate?: string;
    maxUses?: number;
    uses: number;
}