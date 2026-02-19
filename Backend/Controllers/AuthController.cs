using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;
using Messaging_App.Data;

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
        newUser.passwordHash = registerRequest.password;

        db.Users.Add(newUser);

        await db.SaveChangesAsync();

        return Ok(new AuthResult {success = true, message = "Account successfully created"});
    }

    //LOGIN

    //REFRESH

    //LOGOUT
}