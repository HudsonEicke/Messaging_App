using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;
using Messaging_App.Data;
using Microsoft.AspNetCore.Identity;

namespace Messaging_App.Controllers;

[ApiController]
[Route("[controller]")]
public class AuthController : ControllerBase
{
    private readonly MessagingAppContext db;

    public AuthController(MessagingAppContext db)
    {
        this.db = db;
    }

    //REGISTER
    [HttpPost("register")]
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

        result.success = true;
        result.message = "Account successfully created";

        return Ok(result);
    }

    //LOGIN
    [HttpPost("login")]
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
            result.message = "Username not found";
            return Unauthorized(result);
        }

        
        PasswordHasher<User> passwordHasher = new PasswordHasher<User>();
        PasswordVerificationResult hashResult = passwordHasher.VerifyHashedPassword(foundUser, foundUser.passwordHash, loginRequest.password);

        if(hashResult == PasswordVerificationResult.Failed)
        {
            result.success = false;
            result.message = "Incorrect password";
            return Unauthorized(result);
        }

        result.success = true;
        result.message = "Login successful";
        return Ok(result);
    }

    //REFRESH

    //LOGOUT
}