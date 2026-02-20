using Messaging_App.Data;
using Messaging_App.Models;
using Microsoft.EntityFrameworkCore;

namespace Messaging_App.Services;

public class AuthService
{
    private readonly MessagingAppContext db;
    
    public AuthService(MessagingAppContext db)
    {
        this.db = db;
    }

    public async Task<RefreshToken?> GetStoredRefreshToken(string refreshToken)
    {
        RefreshToken ? foundToken = await db.RefreshTokens.FirstOrDefaultAsync(token => token.token == refreshToken);

        return foundToken;
    }

    public async Task SaveRefreshToken(RefreshToken refreshToken)
    {
        db.RefreshTokens.Add(refreshToken);
        await db.SaveChangesAsync();
    }

    public async Task RevokeRefreshToken(RefreshToken refreshToken)
    {
        refreshToken.revoked = true;
        await db.SaveChangesAsync();
    }
}