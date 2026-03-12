using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;
using Messaging_App.Data;
using Microsoft.AspNetCore.Identity;
using Messaging_App.Services;
using Microsoft.AspNetCore.Authorization;

namespace Messaging_App.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class UserController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly AuthService authService;

    public UserController(MessagingAppContext db, AuthService authService)
    {
        this.db = db;
        this.authService = authService;
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserDetailedResult>> GetMe()
    {
        long? nullableUserId = GetUserId();

        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        User? foundUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.id == userId);

        if(foundUser == null)
        {
            return NotFound();
        }

        UserDetailedResult detailedResult = new UserDetailedResult();

        detailedResult.displayName = foundUser.displayName;
        detailedResult.username = foundUser.username;
        detailedResult.email = foundUser.email;
        detailedResult.profileImageUrl = foundUser.profileImageUrl;
        detailedResult.activityStatus = foundUser.activityStatus;
        detailedResult.accountCreationTime = foundUser.accountCreationTime;

        return Ok(detailedResult);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserResult>> GetUserByID(long id)
    {
        User? foundUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.id == id);

        if(foundUser == null)
        {
            return NotFound();
        }

        UserResult result = new UserResult();

        result.displayName = foundUser.displayName;
        result.username = foundUser.username;
        result.profileImageUrl = foundUser.profileImageUrl;
        result.activityStatus = foundUser.activityStatus;
        result.accountCreationTime = foundUser.accountCreationTime;

        return Ok(result);
    }

    [HttpGet("username/{username}")]
    public async Task<ActionResult<UserResult>> GetByUsername(string username)
    {
        User? foundUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.username == username);

        if(foundUser == null)
        {
            return NotFound();
        }

        UserResult result = new UserResult();

        result.displayName = foundUser.displayName;
        result.username = foundUser.username;
        result.profileImageUrl = foundUser.profileImageUrl;
        result.activityStatus = foundUser.activityStatus;
        result.accountCreationTime = foundUser.accountCreationTime;

        return Ok(result);
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMe(UpdateMeRequest updateRequest)
    {
        if(updateRequest.displayName == null && updateRequest.profileImageUrl == null)
        {
            return BadRequest("No fields provided to update");
        }

        long? nullableUserId = GetUserId();

        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        User? foundUser = await db.Users.FirstOrDefaultAsync(user => user.id == userId);

        if(foundUser == null)
        {
            return NotFound();
        }

        if(updateRequest.displayName != null)
        {
            string trimmed = updateRequest.displayName.Trim();
            if(string.IsNullOrWhiteSpace(trimmed))
            {
                foundUser.displayName = foundUser.username;
            }
            else
            {
                foundUser.displayName = trimmed;
            }
        }

        if(updateRequest.profileImageUrl != null)
        {
            foundUser.profileImageUrl = updateRequest.profileImageUrl;
        }

        await db.SaveChangesAsync();

        UserResult result = new UserResult();

        result.displayName = foundUser.displayName;
        result.username = foundUser.username;
        result.profileImageUrl = foundUser.profileImageUrl;
        result.activityStatus = foundUser.activityStatus;
        result.accountCreationTime = foundUser.accountCreationTime;

        return Ok(result);
    }

    [HttpPut("me/password")]
    public async Task<IActionResult> UpdatePassword(UpdatePasswordRequest updatePasswordRequest)
    {
        if(string.IsNullOrWhiteSpace(updatePasswordRequest.currentPassword) || string.IsNullOrWhiteSpace(updatePasswordRequest.newPassword))
        {
            return BadRequest("All fields must be filled");
        }

        if(updatePasswordRequest.currentPassword == updatePasswordRequest.newPassword)
        {
            return BadRequest("New password must be different from current password");
        }

        long? nullableUserId = GetUserId();

        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        User? foundUser = await db.Users.FirstOrDefaultAsync(user => user.id == userId);

        if(foundUser == null)
        {
            return NotFound();
        }

        PasswordHasher<User> passwordHasher = new PasswordHasher<User>();
        PasswordVerificationResult hashResult = passwordHasher.VerifyHashedPassword(foundUser, foundUser.passwordHash, updatePasswordRequest.currentPassword);

        if(hashResult == PasswordVerificationResult.Failed)
        {
            return Unauthorized("Invalid credentials");
        }

        foundUser.passwordHash = passwordHasher.HashPassword(foundUser, updatePasswordRequest.newPassword);

        List<RefreshToken> userTokens = await db.RefreshTokens.Where(rt => rt.userID == userId && !rt.revoked).ToListAsync();

        foreach(RefreshToken token in userTokens)
        {
            await authService.RevokeRefreshToken(token);
        }

        await db.SaveChangesAsync();

        return Ok();
    }

    [HttpPut("me/status")]
    public async Task<IActionResult> UpdateStatus(UpdateStatusRequest statusRequest)
    {
        if (!Enum.IsDefined(typeof(ActivityStatus), statusRequest.newStatus))
        {
            return BadRequest("Invalid status value.");
        }

        long? nullableUserId = GetUserId();

        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        User? foundUser = await db.Users.FirstOrDefaultAsync(user => user.id == userId);

        if(foundUser == null)
        {
            return NotFound();
        }

        foundUser.activityStatus = statusRequest.newStatus;

        await db.SaveChangesAsync();

        return Ok();
    }
}