using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;
using Messaging_App.Data;
using Microsoft.AspNetCore.Identity;
using Messaging_App.Services;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using Messaging_App.Configuration;
using Microsoft.AspNetCore.Authorization;

namespace Messaging_App.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class UserController : ControllerBase
{
    private readonly MessagingAppContext db;
    private readonly JwtService jwtService;
    private readonly AuthService authService;
    private readonly JwtSettings jwtSettings;

    public UserController(MessagingAppContext db, JwtService jwtService, AuthService authService, IOptions<JwtSettings> jwtSettings)
    {
        this.db = db;
        this.jwtService = jwtService;
        this.authService = authService;
        this.jwtSettings = jwtSettings.Value;
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserDetailedResult>> GetMe()
    {

        string ? stringId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if(stringId == null)
        {
            return Unauthorized();
        }

        long userId = long.Parse(stringId);

        User? foundUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.id == userId);

        if(foundUser == null)
        {
            return NotFound();
        }

        UserDetailedResult detailedResult = new UserDetailedResult();

        detailedResult.displayName = foundUser.displayName;
        detailedResult.username = foundUser.username;
        detailedResult.profileImageUrl = foundUser.profileImageUrl;
        detailedResult.activityStatus = foundUser.activityStatus;
        detailedResult.accountCreationTime = foundUser.accountCreationTime;

        return Ok(detailedResult);
    }
}