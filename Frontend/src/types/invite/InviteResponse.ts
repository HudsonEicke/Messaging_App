export interface InviteResponse
{
    inviteCode: string;
    createdByUsername: string;
    createdDate: string;
    // null when the invite never expires or has no use limit
    expiresDate: string | null;
    maxUses: number | null;
    uses: number;
}