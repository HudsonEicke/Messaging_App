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
[Route("friends")]
public class FriendController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly PresenceService presenceService;
    private readonly IHubContext<ChatHub> hubContext;

    public FriendController(MessagingAppContext db, PresenceService presenceService, IHubContext<ChatHub> hubContext)
    {
        this.db = db;
        this.presenceService = presenceService;
        this.hubContext = hubContext;
    }

    private UserResult BuildUserResult(User user)
    {
        UserResult result = new UserResult();
        result.displayName = user.displayName;
        result.username = user.username;
        result.profileImageUrl = user.profileImageUrl;
        result.activityStatus = presenceService.GetDisplayedStatus(user.id, user.activityStatus);
        result.accountCreationTime = user.accountCreationTime;

        return result;
    }

    //every hub event below goes to all of that user's tabs
    private async Task SendToUser(long userId, string eventName, object argument)
    {
        await hubContext.Clients.User(userId.ToString()).SendAsync(eventName, argument);
    }

    [HttpPost("requests")]
    public async Task<ActionResult<FriendRequestResult>> SendRequest(SendFriendRequestRequest friendRequest)
    {
        if(string.IsNullOrWhiteSpace(friendRequest.username))
        {
            return BadRequest("Username is required");
        }

        string username = friendRequest.username;

        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        User? otherUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.username == username);

        if(otherUser == null)
        {
            return NotFound();
        }

        if(otherUser.id == userId)
        {
            return BadRequest("Cannot be friends with yourself");
        }

        List<Friend> foundFriends = await db.Friends.Where(request => (request.sender == userId && request.receiver == otherUser.id) || (request.receiver == userId && request.sender == otherUser.id)).ToListAsync();

        User? currentUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.id == userId);

        if(currentUser == null)
        {
            return Unauthorized();
        }

        FriendRequestResult result = new FriendRequestResult();
        result.user = BuildUserResult(otherUser);

        //checks if either user has sent a request or not
        if(foundFriends.Count == 0)
        {
            Friend newFriendRequest = new Friend();
            newFriendRequest.sender = userId;
            newFriendRequest.receiver = otherUser.id;
            newFriendRequest.status = FriendStatus.pending;

            result.status = FriendStatus.pending;

            db.Friends.Add(newFriendRequest);
        }
        else
        {
            Friend? myRow = foundFriends.FirstOrDefault(f => f.sender == userId);
            Friend? theirRow = foundFriends.FirstOrDefault(f => f.sender == otherUser.id);

            if(myRow?.status == FriendStatus.blocked)
                return BadRequest("Unable to send request as you have blocked this user");

            if(theirRow?.status == FriendStatus.blocked)
                return BadRequest("Unable to send request as the other user has blocked you");

            if(myRow?.status == FriendStatus.friends || theirRow?.status == FriendStatus.friends)
                return BadRequest("Cannot send friend request as you are already friends");

            if(myRow?.status == FriendStatus.pending)
                return BadRequest("Friend request already sent");

            if(theirRow?.status == FriendStatus.pending)
            {
                theirRow.status = FriendStatus.friends;
                result.status = FriendStatus.friends;
            }
        }

        await db.SaveChangesAsync();

        //if they had already sent one, the request accepted it instead
        if(result.status == FriendStatus.friends)
        {
            await SendToUser(userId, "FriendAdded", result.user);
            await SendToUser(otherUser.id, "FriendAdded", BuildUserResult(currentUser));
        }
        else
        {
            await SendToUser(userId, "FriendRequestSent", result.user);
            await SendToUser(otherUser.id, "FriendRequestReceived", BuildUserResult(currentUser));
        }

        return Ok(result);
    }

    [HttpPost("requests/{username}/accept")]
    public async Task<ActionResult<UserResult>> AcceptRequest(string username)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        User? otherUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.username == username);

        if(otherUser == null)
        {
            return NotFound();
        }

        if(otherUser.id == userId)
        {
            return BadRequest("Cannot be friends with yourself");
        }

        Friend? request = await db.Friends.FirstOrDefaultAsync(friend => friend.sender == otherUser.id && friend.receiver == userId && friend.status == FriendStatus.pending);

        if(request == null)
        {
            return NotFound("No pending friend request from user");
        }

        request.status = FriendStatus.friends;

        await db.SaveChangesAsync();

        UserResult result = BuildUserResult(otherUser);

        User? currentUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.id == userId);

        await SendToUser(userId, "FriendAdded", result);

        if(currentUser != null)
        {
            await SendToUser(otherUser.id, "FriendAdded", BuildUserResult(currentUser));
        }

        return Ok(result);
    }

    //declines a request they sent, or cancels one you sent
    [HttpDelete("requests/{username}")]
    public async Task<IActionResult> DeleteRequest(string username)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        User? otherUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.username == username);

        if(otherUser == null)
        {
            return NotFound();
        }

        if(otherUser.id == userId)
        {
            return BadRequest("Cannot be friends with yourself");
        }

        Friend? request = await db.Friends.FirstOrDefaultAsync(friend => ((friend.sender == otherUser.id && friend.receiver == userId) || (friend.sender == userId && friend.receiver == otherUser.id)) && friend.status == FriendStatus.pending);

        if(request == null)
        {
            return NotFound("No pending friend request with user");
        }

        db.Friends.Remove(request);

        await db.SaveChangesAsync();

        await SendToUser(userId, "FriendRemoved", otherUser.username);
        await SendToUser(otherUser.id, "FriendRemoved", GetUsername() ?? string.Empty);

        return NoContent();
    }

    [HttpDelete("{username}")]
    public async Task<IActionResult> UnfriendUser(string username)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        User? otherUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.username == username);

        if(otherUser == null)
        {
            return NotFound();
        }

        if(otherUser.id == userId)
        {
            return BadRequest("Cannot be friends with yourself");
        }

        Friend? request = await db.Friends.FirstOrDefaultAsync(friend => ((friend.sender == otherUser.id && friend.receiver == userId) || (friend.receiver == otherUser.id && friend.sender == userId)) && friend.status == FriendStatus.friends);

        if(request == null)
        {
            return BadRequest("You are not friends with this user");
        }

        db.Friends.Remove(request);

        await db.SaveChangesAsync();

        await SendToUser(userId, "FriendRemoved", otherUser.username);
        await SendToUser(otherUser.id, "FriendRemoved", GetUsername() ?? string.Empty);

        return NoContent();
    }

    [HttpPut("blocked/{username}")]
    public async Task<IActionResult> BlockUser(string username)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        User? otherUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.username == username);

        if(otherUser == null)
        {
            return NotFound();
        }

        if(otherUser.id == userId)
        {
            return BadRequest("Cannot block yourself");
        }
        
        List<Friend> foundFriends = await db.Friends.Where(friend => (friend.sender == userId && friend.receiver == otherUser.id) || (friend.sender == otherUser.id && friend.receiver == userId)).ToListAsync();

        Friend? myRow = foundFriends.FirstOrDefault(f => f.sender == userId);
        Friend? theirRow = foundFriends.FirstOrDefault(f => f.sender == otherUser.id);

        if(myRow?.status == FriendStatus.blocked)
            return BadRequest("You have already blocked this user");

        //a block of their own stays, so both people can block each other
        bool hadRelationship = (theirRow != null && theirRow.status != FriendStatus.blocked) || myRow != null;

        if(theirRow != null && theirRow.status != FriendStatus.blocked)
            db.Friends.Remove(theirRow);

        if(myRow != null && myRow.status != FriendStatus.blocked)
            db.Friends.Remove(myRow);
        
        Friend blockRequest = new Friend();
        blockRequest.sender = userId;
        blockRequest.receiver = otherUser.id;
        blockRequest.status = FriendStatus.blocked;

        db.Friends.Add(blockRequest);

        await db.SaveChangesAsync();

        await SendToUser(userId, "UserBlocked", BuildUserResult(otherUser));

        //they only see the friendship or request go away, not that they were blocked
        if(hadRelationship)
        {
            await SendToUser(otherUser.id, "FriendRemoved", GetUsername() ?? string.Empty);
        }

        return NoContent();
    }

    [HttpDelete("blocked/{username}")]
    public async Task<IActionResult> UnBlockUser(string username)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        User? otherUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.username == username);

        if(otherUser == null)
        {
            return NotFound();
        }

        if(otherUser.id == userId)
        {
            return BadRequest("Cannot block yourself");
        }

        Friend? blocked = await db.Friends.FirstOrDefaultAsync(friend => friend.sender == userId && friend.receiver == otherUser.id && friend.status == FriendStatus.blocked);

        if(blocked == null)
        {
            return BadRequest("You have not blocked this user");
        }

        db.Remove(blocked);

        await db.SaveChangesAsync();

        await SendToUser(userId, "UserUnblocked", otherUser.username);

        return NoContent();
    }

    [HttpGet]
    public async Task<ActionResult<List<UserResult>>> GetFriends()
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        List<UserResult> results = await db.Friends.Where(friend => (friend.sender == userId || friend.receiver == userId) && friend.status == FriendStatus.friends).Join(db.Users, friend => friend.sender == userId ? friend.receiver : friend.sender, user => user.id, (friend, user) => new UserResult{displayName = user.displayName, username = user.username, profileImageUrl = user.profileImageUrl, activityStatus = presenceService.GetDisplayedStatus(user.id, user.activityStatus), accountCreationTime = user.accountCreationTime}).ToListAsync();

        return Ok(results);
    }

    //incoming unless direction=outgoing
    [HttpGet("requests")]
    public async Task<ActionResult<List<UserResult>>> GetPendingFriends([FromQuery] FriendRequestDirection direction = FriendRequestDirection.incoming)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        if(direction == FriendRequestDirection.outgoing)
        {
            List<UserResult> outgoingResults = await db.Friends.Where(friend => friend.sender == userId && friend.status == FriendStatus.pending).Join(db.Users, friend => friend.receiver, user => user.id, (friend, user) => new UserResult{displayName = user.displayName, username = user.username, profileImageUrl = user.profileImageUrl, activityStatus = presenceService.GetDisplayedStatus(user.id, user.activityStatus), accountCreationTime = user.accountCreationTime}).ToListAsync();

            return Ok(outgoingResults);
        }

        List<UserResult> results = await db.Friends.Where(friend => friend.receiver == userId && friend.status == FriendStatus.pending).Join(db.Users, friend => friend.sender, user => user.id, (friend, user) => new UserResult{displayName = user.displayName, username = user.username, profileImageUrl = user.profileImageUrl, activityStatus = presenceService.GetDisplayedStatus(user.id, user.activityStatus), accountCreationTime = user.accountCreationTime}).ToListAsync();

        return Ok(results);
    }

    [HttpGet("blocked")]
    public async Task<ActionResult<List<UserResult>>> GetBlockedUsers()
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        List<UserResult> results = await db.Friends.Where(friend => friend.sender == userId && friend.status == FriendStatus.blocked).Join(db.Users, friend => friend.receiver, user => user.id, (friend, user) => new UserResult{displayName = user.displayName, username = user.username, profileImageUrl = user.profileImageUrl, activityStatus = presenceService.GetDisplayedStatus(user.id, user.activityStatus), accountCreationTime = user.accountCreationTime}).ToListAsync();

        return Ok(results);
    }
}