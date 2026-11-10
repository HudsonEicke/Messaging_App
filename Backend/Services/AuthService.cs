using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Messaging_App.Configuration;
using Messaging_App.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Messaging_App.Services;

public class AuthService
{
    private readonly MessagingAppContext db;
    private readonly JwtService jwtService;
    private readonly JwtSettings jwtSettings;

    public AuthService(MessagingAppContext db, JwtService jwtService, IOptions<JwtSettings> jwtSettings)
    {
        this.db = db;
        this.jwtService = jwtService;
        this.jwtSettings = jwtSettings.Value;
    }

    public async Task<AuthResult> IssueTokens(User user)
    {
        Claim[] claims = {new Claim(ClaimTypes.Name, user.username), new Claim(ClaimTypes.NameIdentifier, user.id.ToString())};

        string accessToken = jwtService.GenerateAccessToken(claims);
        string refreshToken = jwtService.GenerateRefreshToken();

        RefreshToken newToken = new RefreshToken();
        newToken.userID = user.id;
        newToken.token = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));
        newToken.expiresDate = DateTime.UtcNow.AddDays(jwtSettings.RefreshTokenExpirationDays);
        await DeleteExpiredRefreshTokens(user.id);
        await SaveRefreshToken(newToken);

        AuthResult result = new AuthResult();
        result.success = true;
        result.accessToken = accessToken;
        result.refreshToken = refreshToken;

        return result;
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

    public async Task DeleteExpiredRefreshTokens(long userID)
    {
        await db.RefreshTokens.Where(token => token.userID == userID && token.expiresDate < DateTimeOffset.UtcNow).ExecuteDeleteAsync();
    }
}