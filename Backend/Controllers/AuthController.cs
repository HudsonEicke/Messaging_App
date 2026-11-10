using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Data;
using Microsoft.AspNetCore.Identity;
using Messaging_App.Services;
using Microsoft.AspNetCore.RateLimiting;

namespace Messaging_App.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly MessagingAppContext db;
    private readonly AuthService authService;

    public AuthController(MessagingAppContext db, AuthService authService)
    {
        this.db = db;
        this.authService = authService;
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

        //"me" is reserved because routes like /servers/{id}/members/me refer to the logged in user
        if(string.Equals(registerRequest.username, "me", StringComparison.OrdinalIgnoreCase))
        {
            result.message = "That username is reserved";
            result.success = false;
            return BadRequest(result);
        }

        //finds if the user exists already
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

        //adds the user to the database
        User newUser = new User();

        newUser.username = registerRequest.username;
        newUser.displayName = registerRequest.username;
        newUser.email = registerRequest.email;

        //password hashing for safer password storage
        PasswordHasher<User> passwordHasher = new PasswordHasher<User>();
        newUser.passwordHash = passwordHasher.HashPassword(newUser, registerRequest.password);

        db.Users.Add(newUser);

        //the checks above can both pass when two people sign up with the same name at once, the unique constraint catches the second
        try
        {
            await db.SaveChangesAsync();
        }
        catch(DbUpdateException exception) when (exception.IsUniqueViolation())
        {
            result.message = exception.IsUniqueViolation("users_email_key") ? "Email already in use" : "Username already in use";
            result.success = false;
            return Conflict(result);
        }

        result = await authService.IssueTokens(newUser);
        result.message = "Account successfully created";

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

        //tries to find the user
        User? foundUser = await db.Users.FirstOrDefaultAsync(user => user.username == loginRequest.username);

        if(foundUser == null)
        {
            result.success = false;
            result.message = "Invalid credentials";
            return Unauthorized(result);
        }
        
        //checks if the users password matches hashed password
        PasswordHasher<User> passwordHasher = new PasswordHasher<User>();
        PasswordVerificationResult hashResult = passwordHasher.VerifyHashedPassword(foundUser, foundUser.passwordHash, loginRequest.password);

        if(hashResult == PasswordVerificationResult.Failed)
        {
            result.success = false;
            result.message = "Invalid credentials";
            return Unauthorized(result);
        }

        //rehashes password to newer standard if required
        if(hashResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            foundUser.passwordHash = passwordHasher.HashPassword(foundUser, loginRequest.password);
            await db.SaveChangesAsync();
        }

        result = await authService.IssueTokens(foundUser);
        result.message = "Login successful";
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

        //if the refresh token may have been stolen revoke all tokens
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

        //checks if the refresh token is expired
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

        await authService.RevokeRefreshToken(foundToken);

        result = await authService.IssueTokens(foundUser);
        result.message = "New token successfully generated";

        return Ok(result);
    }

    //LOGOUT
    [HttpPost("logout")]
    public async Task<ActionResult<AuthResult>> Logout(LogoutRequest logoutRequest)
    {
        AuthResult result = new AuthResult();

        RefreshToken ? token = await authService.GetStoredRefreshToken(logoutRequest.refreshToken);

        //revokes old refresh token
        if(token != null)
        {
            await authService.RevokeRefreshToken(token);
        }

        result.success = true;
        result.message = "Logout successful";

        return Ok(result);
    }
}