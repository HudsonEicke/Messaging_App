using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Messaging_App.Configuration;
using Messaging_App.Services;
using Microsoft.Extensions.Options;

namespace Backend.Tests.Unit;

public class JwtServiceTests
{
    private readonly JwtService jwtService;
    private readonly JwtSettings jwtSettings;

    public JwtServiceTests()
    {
        jwtSettings = new JwtSettings
        {
            SecretKey = "test-secret-key-32-chars-minimum!",
            Issuer = "http://localhost",
            Audience = "MessagingAppAPI",
            AccessTokenExpirationMinutes = 15,
            RefreshTokenExpirationDays = 7
        };

        jwtService = new JwtService(Options.Create(jwtSettings));
    }

    [Fact]
    public void GenerateAccessToken_WithValidClaims_ReturnsValidJwtToken()
    {
        //arrange
        Claim[] claims = [new Claim(ClaimTypes.Name, "testuser"), new Claim(ClaimTypes.NameIdentifier, "1")];
        JwtSecurityTokenHandler handler = new JwtSecurityTokenHandler();
    
        //act
        string token = jwtService.GenerateAccessToken(claims);
    
        //assert
        Assert.True(handler.CanReadToken(token));
    }

    [Fact]
    public void GenerateAccessToken_WithValidClaims_ContainsExpectedUsername()
    {
        //arrange
        Claim[] claims = [new Claim(ClaimTypes.Name, "testuser"), new Claim(ClaimTypes.NameIdentifier, "1")];

        //act
        string token = jwtService.GenerateAccessToken(claims);
        JwtSecurityToken parsedToken = new JwtSecurityTokenHandler().ReadJwtToken(token);

        //assert
        Assert.Contains(parsedToken.Claims, claim => claim.Type == ClaimTypes.Name && claim.Value == "testuser");
    }

    [Fact]
    public void GenerateAccessToken_WithValidClaims_ContainsExpectedUserId()
    {
        //arrange
        Claim[] claims = [new Claim(ClaimTypes.Name, "testuser"), new Claim(ClaimTypes.NameIdentifier, "1")];

        //act
        string token = jwtService.GenerateAccessToken(claims);
        JwtSecurityToken parsedToken = new JwtSecurityTokenHandler().ReadJwtToken(token);

        //assert
        Assert.Contains(parsedToken.Claims, claim => claim.Type == ClaimTypes.NameIdentifier && claim.Value == "1");
    }

    [Fact]
    public void GenerateAccessToken_WithValidClaims_ContainsCorrectIssuer()
    {
        //arrange
        Claim[] claims = [new Claim(ClaimTypes.Name, "testuser")];

        //act
        string token = jwtService.GenerateAccessToken(claims);
        JwtSecurityToken parsedToken = new JwtSecurityTokenHandler().ReadJwtToken(token);

        //assert
        Assert.Equal(jwtSettings.Issuer, parsedToken.Issuer);
    }

    [Fact]
    public void GenerateAccessToken_WithValidClaims_ContainsCorrectAudience()
    {
        //arrange
        Claim[] claims = [new Claim(ClaimTypes.Name, "testuser")];

        //act
        string token = jwtService.GenerateAccessToken(claims);
        JwtSecurityToken parsedToken = new JwtSecurityTokenHandler().ReadJwtToken(token);

        //assert
        Assert.Contains(jwtSettings.Audience, parsedToken.Audiences);
    }

    [Fact]
    public void GenerateAccessToken_WithValidClaims_ExpiresAtCorrectTime()
    {
        //arrange
        Claim[] claims = [new Claim(ClaimTypes.Name, "testuser")];

        //act
        string token = jwtService.GenerateAccessToken(claims);
        JwtSecurityToken parsedToken = new JwtSecurityTokenHandler().ReadJwtToken(token);

        //assert
        Assert.True(parsedToken.ValidTo <= DateTime.UtcNow.AddMinutes(jwtSettings.AccessTokenExpirationMinutes + 1));
    }

    [Fact]
    public void GenerateRefreshToken_ReturnsBase64String()
    {
        //arrange

        //act
        string refreshToken = jwtService.GenerateRefreshToken();
        byte[] bytes = Convert.FromBase64String(refreshToken);

        //assert
        Assert.NotEmpty(bytes);
    }

    [Fact]
    public void GenerateRefreshToken_CalledTwice_ReturnsDifferentTokens()
    {
        //arrange

        //act
        string token1 = jwtService.GenerateRefreshToken();
        string token2 = jwtService.GenerateRefreshToken();

        //assert
        Assert.NotEqual(token1, token2);
    }

    [Fact]
    public void GenerateRefreshToken_Returns32ByteToken()
    {
        //arrange

        //act
        string refreshToken = jwtService.GenerateRefreshToken();
        byte[] bytes = Convert.FromBase64String(refreshToken);

        //assert
        Assert.Equal(32, bytes.Length);
    }
}