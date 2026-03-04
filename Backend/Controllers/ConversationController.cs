using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;
using Messaging_App.Data;
using Messaging_App.Services;
using Microsoft.AspNetCore.Authorization;
using System.Text;

namespace Messaging_App.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class ConversationController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly EncryptionService encryptionService;
    private const int MESSAGEGRABAMOUNT = 50;
    private const int MAXCONVERSATIONMEMBERS = 25;

    public ConversationController(MessagingAppContext db, EncryptionService encryptionService)
    {
        this.db = db;
        this.encryptionService = encryptionService;
    }

    [HttpPost("createconversation")]
    public async Task<ActionResult<CreateConversationResult>> CreateConversation(CreateConversationRequest createConversationRequest)
    {
        if(createConversationRequest.memberUsernames.Count == 0)
        {
            return BadRequest("Conversations must contain at least 1 other member");
        }

        if(createConversationRequest.memberUsernames.Count > MAXCONVERSATIONMEMBERS - 1)
        {
            return BadRequest($"Conversations can only have {MAXCONVERSATIONMEMBERS} members");
        }

        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        User? creatingUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.id == userId);

        if(creatingUser == null)
        {
            return NotFound();
        }

        Conversation newConversation;
        CreateConversationResult result;

        if(createConversationRequest.memberUsernames.Count == 1)
        {
            User? otherUser = await db.Users.FirstOrDefaultAsync(user => user.username == createConversationRequest.memberUsernames[0]);

            if(otherUser == null)
            {
                return NotFound();
            }

            if(otherUser.id == userId)
            {
                return Forbid();
            }

            bool existingConversation = await db.ConversationMembers.Where(cm => cm.userID == userId).Join(db.ConversationMembers, cm1 => cm1.conversationID, cm2 => cm2.conversationID, (cm1, cm2) => new { cm1, cm2 }).Join(db.Conversations, c => c.cm1.conversationID, conv => conv.id, (c, conv) => new { c.cm1, c.cm2, conv }).AnyAsync(x => x.cm2.userID == otherUser.id && x.conv.conversationType == ConversationType.direct);

            if(existingConversation)
            {
                return Conflict("You already have a dm with this user");
            }

            newConversation = new Conversation();
            newConversation.conversationType = ConversationType.direct;

            db.Conversations.Add(newConversation);
            await db.SaveChangesAsync();

            ConversationMember newConversationMember1 = new ConversationMember();
            newConversationMember1.conversationID = newConversation.id;
            newConversationMember1.userID = userId;
            db.ConversationMembers.Add(newConversationMember1);

            ConversationMember newConversationMember2 = new ConversationMember();
            newConversationMember2.conversationID = newConversation.id;
            newConversationMember2.userID = otherUser.id;
            db.ConversationMembers.Add(newConversationMember2);

            await db.SaveChangesAsync();

            result = new CreateConversationResult();
            result.conversationID = newConversation.id;
            result.conversationName = otherUser.displayName;
            result.iconUrl = otherUser.profileImageUrl;
            result.memberUsernames = new List<string> { creatingUser.username, otherUser.username };

            return Ok(result);
        }
        
        List<User> members = new List<User>();

        foreach(string username in createConversationRequest.memberUsernames)
        {
            User? foundUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.username == username);

            if(foundUser == null)
            {
                return NotFound();
            }

            if(foundUser.id == userId)
            {
                return Forbid();
            }

            members.Add(foundUser);
        }

        newConversation = new Conversation();
        newConversation.conversationType = ConversationType.group;
        newConversation.ownerID = userId;
        newConversation.iconUrl = createConversationRequest.iconUrl;

        if(string.IsNullOrWhiteSpace(createConversationRequest.conversationName))
        {
            newConversation.conversationName = string.Join(", ", new[] { creatingUser.displayName }.Concat(members.Select(user => user.displayName)));
        }
        else
        {
            newConversation.conversationName = createConversationRequest.conversationName;
        }

        db.Conversations.Add(newConversation);

        await db.SaveChangesAsync();

        ConversationMember newMember = new ConversationMember();
        newMember.conversationID = newConversation.id;
        newMember.userID = userId;
        db.ConversationMembers.Add(newMember);

        foreach(User user in members)
        {
            newMember = new ConversationMember();
            newMember.conversationID = newConversation.id;
            newMember.userID = user.id;
            db.ConversationMembers.Add(newMember);
        }

        await db.SaveChangesAsync();

        result = new CreateConversationResult();
        result.conversationID = newConversation.id;
        result.conversationName = newConversation.conversationName;
        result.ownerUsername = creatingUser.username;
        result.conversationType = ConversationType.group;
        result.iconUrl = newConversation.iconUrl;
        result.memberUsernames = createConversationRequest.memberUsernames.Append(creatingUser.username).ToList();

        return Ok(result);
    }
}