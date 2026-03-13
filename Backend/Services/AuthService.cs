using System.Security.Cryptography;
using System.Text;
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
        string hashedToken = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));
        RefreshToken? foundToken = await db.RefreshTokens.FirstOrDefaultAsync(token => token.token == hashedToken);
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