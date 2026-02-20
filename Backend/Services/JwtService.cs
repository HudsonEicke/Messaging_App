using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Messaging_App.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Messaging_App.Services;

public class JwtService
{
    private readonly JwtSettings jwtSettings;

    public JwtService(IOptions<JwtSettings> jwtSettings)
    {
        this.jwtSettings = jwtSettings.Value;
    }

    public string GenerateAccessToken(IEnumerable<Claim> claims)
    {
        byte[] encodedSecret = Encoding.UTF8.GetBytes(jwtSettings.SecretKey);
        SymmetricSecurityKey key = new SymmetricSecurityKey(encodedSecret);
        
        SigningCredentials creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        JwtSecurityToken token = new JwtSecurityToken(jwtSettings.Issuer, jwtSettings.Audience, claims, null, DateTime.UtcNow.AddMinutes(jwtSettings.AccessTokenExpirationMinutes), creds);
        
        string tokenString = new JwtSecurityTokenHandler().WriteToken(token);

        return tokenString;
    }

    public string GenerateRefreshToken()
    {
        byte[] randomNumber = new byte[32];

        using(RandomNumberGenerator randomGenerator = RandomNumberGenerator.Create())
        {
            randomGenerator.GetBytes(randomNumber);
        }

        return Convert.ToBase64String(randomNumber);
    }
}