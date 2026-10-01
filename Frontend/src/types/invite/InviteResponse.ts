export interface InviteResponse
{
    inviteCode: string;
    createdByUsername: string;
    createdDate: string;
    expiresDate?: string;
    maxUses?: number;
    uses: number;
}