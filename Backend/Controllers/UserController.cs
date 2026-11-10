using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Data;
using Microsoft.AspNetCore.Identity;
using Messaging_App.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Messaging_App.Hubs;

namespace Messaging_App.Controllers;

[Authorize]
[ApiController]
[Route("users")]
public class UserController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly AuthService authService;
    private readonly IHubContext<ChatHub> hubContext;
    private readonly PresenceService presenceService;
    private readonly FriendService friendService;

    public UserController(MessagingAppContext db, AuthService authService, IHubContext<ChatHub> hubContext, PresenceService presenceService, FriendService friendService)
    {
        this.db = db;
        this.presenceService = presenceService;
        this.friendService = friendService;
        this.authService = authService;
        this.hubContext = hubContext;
    }

    //detailed get user
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
        detailedResult.activityStatus = foundUser.activityStatus; //your own status is the one you picked, so the status picker shows it even before SignalR connects
        detailedResult.accountCreationTime = foundUser.accountCreationTime;

        return Ok(detailedResult);
    }

    [HttpGet("{id:long}")]
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
        result.activityStatus = presenceService.GetDisplayedStatus(foundUser.id, foundUser.activityStatus);
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
        result.activityStatus = presenceService.GetDisplayedStatus(foundUser.id, foundUser.activityStatus);
        result.accountCreationTime = foundUser.accountCreationTime;

        return Ok(result);
    }

    //update profile
    [HttpPatch("me")]
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

        List<long> serverIds = await db.ServerMembers.AsNoTracking().Where(member => member.userID == userId).Select(member => member.serverID).ToListAsync();

        List<long> conversationIds = await db.ConversationMembers.AsNoTracking().Where(member => member.userID == userId).Select(member => member.conversationID).ToListAsync();

        //a dm you closed still shows your name and avatar to the other person, so it's found by the pair columns instead of membership
        List<long> directConversationIds = await db.Conversations.AsNoTracking().Where(conversation => conversation.conversationType == ConversationType.direct && (conversation.directUserLowID == userId || conversation.directUserHighID == userId)).Select(conversation => conversation.id).ToListAsync();

        List<string> groups = new List<string>();
        groups.AddRange(serverIds.Select(id => $"server_{id}"));
        groups.AddRange(conversationIds.Union(directConversationIds).Select(id => $"conversation_{id}"));

        await hubContext.Clients.Groups(groups).SendAsync("UserUpdated", foundUser.username, foundUser.displayName, foundUser.profileImageUrl);

        //friends who share no server or conversation aren't in those groups; someone in both gets it twice, which is harmless
        List<string> friendUserIds = await friendService.GetFriendUserIds(userId);
        await hubContext.Clients.Users(friendUserIds).SendAsync("UserUpdated", foundUser.username, foundUser.displayName, foundUser.profileImageUrl);

        UserResult result = new UserResult();

        result.displayName = foundUser.displayName;
        result.username = foundUser.username;
        result.profileImageUrl = foundUser.profileImageUrl;
        result.activityStatus = foundUser.activityStatus;
        result.accountCreationTime = foundUser.accountCreationTime;

        return Ok(result);
    }

    [HttpPut("me/password")]
    public async Task<ActionResult<AuthResult>> UpdatePassword(UpdatePasswordRequest updatePasswordRequest)
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

        //checks if the users password was correct
        PasswordHasher<User> passwordHasher = new PasswordHasher<User>();
        PasswordVerificationResult hashResult = passwordHasher.VerifyHashedPassword(foundUser, foundUser.passwordHash, updatePasswordRequest.currentPassword);

        if(hashResult == PasswordVerificationResult.Failed)
        {
            return BadRequest("Current password is incorrect");
        }

        if(hashResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            foundUser.passwordHash = passwordHasher.HashPassword(foundUser, updatePasswordRequest.currentPassword);
            await db.SaveChangesAsync();
        }

        //updates the users password
        foundUser.passwordHash = passwordHasher.HashPassword(foundUser, updatePasswordRequest.newPassword);

        //revokes all refresh tokens for user
        List<RefreshToken> userTokens = await db.RefreshTokens.Where(rt => rt.userID == userId && !rt.revoked).ToListAsync();

        foreach(RefreshToken token in userTokens)
        {
            token.revoked = true;
        }

        await db.SaveChangesAsync();

        //every other session is signed out, but this one gets new tokens so it stays signed in
        AuthResult result = await authService.IssueTokens(foundUser);
        result.message = "Password updated";

        return Ok(result);
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

        List<long> serverIds = await db.ServerMembers.AsNoTracking().Where(member => member.userID == userId).Select(member => member.serverID).ToListAsync();

        List<long> conversationIds = await db.ConversationMembers.AsNoTracking().Where(member => member.userID == userId).Select(member => member.conversationID).ToListAsync();

        List<string> groups = new List<string>();
        groups.AddRange(serverIds.Select(id => $"server_{id}"));
        groups.AddRange(conversationIds.Select(id => $"conversation_{id}"));

        await hubContext.Clients.Groups(groups).SendAsync("UserStatusChanged", foundUser.username, presenceService.GetDisplayedStatus(userId, foundUser.activityStatus));

        List<string> friendUserIds = await friendService.GetFriendUserIds(userId);
        await hubContext.Clients.Users(friendUserIds).SendAsync("UserStatusChanged", foundUser.username, presenceService.GetDisplayedStatus(userId, foundUser.activityStatus));

        return Ok();
    }
}