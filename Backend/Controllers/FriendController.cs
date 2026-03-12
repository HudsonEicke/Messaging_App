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
public class FriendController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;

    public FriendController(MessagingAppContext db)
    {
        this.db = db;
    }

    [HttpPost("request/{username}")]
    public async Task<ActionResult<FriendRequestResult>> SendRequest(string username)
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

        List<Friend> foundFriends = await db.Friends.Where(request => (request.sender == userId && request.receiver == otherUser.id) || (request.receiver == userId && request.sender == otherUser.id)).ToListAsync();

        FriendRequestResult result = new FriendRequestResult();

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

        return Ok(result);
    }

    [HttpPost("accept/{username}")]
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

        Friend? request = await db.Friends.FirstOrDefaultAsync(friend => friend.sender == otherUser.id && friend.receiver == userId);

        if(request == null)
        {
            return NotFound("No pending friend request from user");
        }

        if(request.status != FriendStatus.pending)
        {
            return BadRequest("No pending friend request from user");
        }

        request.status = FriendStatus.friends;

        await db.SaveChangesAsync();

        UserResult result = new UserResult();
        result.displayName = otherUser.displayName;
        result.username = username;
        result.profileImageUrl = otherUser.profileImageUrl;
        result.activityStatus = otherUser.activityStatus;
        result.accountCreationTime = otherUser.accountCreationTime;

        return Ok(result);
    }

    [HttpPost("decline/{username}")]
    public async Task<IActionResult> DeclineRequest(string username)
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

        Friend? request = await db.Friends.FirstOrDefaultAsync(friend => friend.sender == otherUser.id && friend.receiver == userId);

        if(request == null)
        {
            return NotFound("No pending friend request from user");
        }

        db.Friends.Remove(request);

        await db.SaveChangesAsync();

        return NoContent();
    }
}