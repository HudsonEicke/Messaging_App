using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;
using Messaging_App.Data;
using Microsoft.AspNetCore.Identity;
using Messaging_App.Services;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using Messaging_App.Configuration;
using Microsoft.AspNetCore.RateLimiting;

namespace Messaging_App.Controllers;

[ApiController]
[Route("[controller]")]
public class AuthController : ControllerBase
{
    private readonly MessagingAppContext db;
    private readonly JwtService jwtService;
    private readonly AuthService authService;
    private readonly JwtSettings jwtSettings;

    public AuthController(MessagingAppContext db, JwtService jwtService, AuthService authService, IOptions<JwtSettings> jwtSettings)
    {
        this.db = db;
        this.jwtService = jwtService;
        this.authService = authService;
        this.jwtSettings = jwtSettings.Value;
    }

    //REGISTER
    [HttpPost("register")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResult>> Register(RegisterRequest registerRequest)
    {
        AuthResult result = new AuthResult();
        result.message = "";

        if(string.IsNullOrWhiteSpace(registerRequest.username) || string.IsNullOrWhiteSpace(registerRequest.password) || string.IsNullOrWhiteSpace(registerRequest.email))
        {
            result.message = "All fields must not be empty";
            result.success = false;
            return BadRequest(result);
        }

        bool usernameSearchResult = await db.Users.AnyAsync(user => user.username == registerRequest.username);
        bool emailSearchResult = await db.Users.AnyAsync(user => user.email == registerRequest.email);

        if(usernameSearchResult && emailSearchResult)
        {
            result.message = "Username and email already in use";
            result.success = false;
            return Conflict(result);
        }
        else if(usernameSearchResult)
        {
            result.message = "Username already in use";
            result.success = false;
            return Conflict(result);
        }
        else if(emailSearchResult)
        {
            result.message = "Email already in use";
            result.success = false;
            return Conflict(result);
        }

        User newUser = new User();

        newUser.username = registerRequest.username;
        newUser.displayName = registerRequest.username;
        newUser.email = registerRequest.email;

        PasswordHasher<User> passwordHasher = new PasswordHasher<User>();
        newUser.passwordHash = passwordHasher.HashPassword(newUser, registerRequest.password);

        db.Users.Add(newUser);

        await db.SaveChangesAsync();

        Claim[] claims = {new Claim(ClaimTypes.Name, newUser.username), new Claim(ClaimTypes.NameIdentifier, newUser.id.ToString())};

        string accessToken = jwtService.GenerateAccessToken(claims);
        string refreshToken = jwtService.GenerateRefreshToken();

        RefreshToken newToken = new RefreshToken();
        newToken.userID = newUser.id;
        newToken.token = refreshToken;
        newToken.expiresDate = DateTime.UtcNow.AddDays(jwtSettings.RefreshTokenExpirationDays);
        await authService.SaveRefreshToken(newToken);

        result.success = true;
        result.message = "Account successfully created";
        result.accessToken = accessToken;
        result.refreshToken = refreshToken;

        return Ok(result);
    }

    //LOGIN
    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResult>> Login(LoginRequest loginRequest)
    {
        AuthResult result = new AuthResult();

        if(string.IsNullOrWhiteSpace(loginRequest.username) || string.IsNullOrWhiteSpace(loginRequest.password))
        {
            result.message = "All fields must not be empty";
            result.success = false;
            return BadRequest(result);
        }

        User? foundUser = await db.Users.FirstOrDefaultAsync(user => user.username == loginRequest.username);

        if(foundUser == null)
        {
            result.success = false;
            result.message = "Invalid credentials";
            return Unauthorized(result);
        }
        
        PasswordHasher<User> passwordHasher = new PasswordHasher<User>();
        PasswordVerificationResult hashResult = passwordHasher.VerifyHashedPassword(foundUser, foundUser.passwordHash, loginRequest.password);

        if(hashResult == PasswordVerificationResult.Failed)
        {
            result.success = false;
            result.message = "Invalid credentials";
            return Unauthorized(result);
        }

        if(hashResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            foundUser.passwordHash = passwordHasher.HashPassword(foundUser, loginRequest.password);
            await db.SaveChangesAsync();
        }

        Claim[] claims = {new Claim(ClaimTypes.Name, foundUser.username), new Claim(ClaimTypes.NameIdentifier, foundUser.id.ToString())};

        string accessToken = jwtService.GenerateAccessToken(claims);
        string refreshToken = jwtService.GenerateRefreshToken();

        RefreshToken newToken = new RefreshToken();
        newToken.userID = foundUser.id;
        newToken.token = refreshToken;
        newToken.expiresDate = DateTime.UtcNow.AddDays(jwtSettings.RefreshTokenExpirationDays);
        await authService.SaveRefreshToken(newToken);

        result.success = true;
        result.message = "Login successful";
        result.accessToken = accessToken;
        result.refreshToken = refreshToken;
        return Ok(result);
    }

    //REFRESH
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResult>> Refresh(RefreshRequest refreshRequest)
    {
        AuthResult result = new AuthResult();

        RefreshToken ? foundToken = await authService.GetStoredRefreshToken(refreshRequest.refreshToken);

        if(foundToken == null)
        {
            result.success = false;
            result.message = "Invalid session";
            return Unauthorized(result);
        }

        if (foundToken.revoked)
        {
            List<RefreshToken> allUserTokens = await db.RefreshTokens.Where(t => t.userID == foundToken.userID && !t.revoked).ToListAsync();

            foreach(RefreshToken token in allUserTokens)
            {
                token.revoked = true;
            }

            await db.SaveChangesAsync();

            result.success = false;
            result.message = "Token has been revoked";
            return Unauthorized(result);
        }

        if(foundToken.expiresDate < DateTime.UtcNow)
        {
            await authService.RevokeRefreshToken(foundToken);
            result.success = false;
            result.message = "Token has expired";
            return Unauthorized(result);
        }

        User ? foundUser = await db.Users.FirstOrDefaultAsync(user => user.id == foundToken.userID);

        if(foundUser == null)
        {
            result.success = false;
            result.message = "Token for invalid user";
            return Unauthorized(result);
        }

        Claim[] claims = {new Claim(ClaimTypes.Name, foundUser.username), new Claim(ClaimTypes.NameIdentifier, foundUser.id.ToString())};
        
        string accessToken = jwtService.GenerateAccessToken(claims);
        string refreshToken = jwtService.GenerateRefreshToken();

        await authService.RevokeRefreshToken(foundToken);

        RefreshToken newToken = new RefreshToken();
        newToken.userID = foundUser.id;
        newToken.token = refreshToken;
        newToken.expiresDate = DateTime.UtcNow.AddDays(jwtSettings.RefreshTokenExpirationDays);
        await authService.SaveRefreshToken(newToken);

        result.accessToken = accessToken;
        result.refreshToken = refreshToken;
        result.success = true;
        result.message = "New token successfully generated";

        return Ok(result);
    }

    //LOGOUT
    [HttpPost("logout")]
    public async Task<ActionResult<AuthResult>> Logout(LogoutRequest logoutRequest)
    {
        AuthResult result = new AuthResult();

        RefreshToken ? token = await authService.GetStoredRefreshToken(logoutRequest.refreshToken);

        if(token != null)
        {
            await authService.RevokeRefreshToken(token);
        }

        result.success = true;
        result.message = "Logout successful";

        return Ok(result);
    }
}