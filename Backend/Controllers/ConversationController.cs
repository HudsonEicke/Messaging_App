using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;
using Messaging_App.Data;
using Messaging_App.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Messaging_App.Hubs;

namespace Messaging_App.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class ConversationController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly EncryptionService encryptionService;
    
    private readonly IHubContext<ChatHub> hubContext;
    private const int MESSAGEGRABAMOUNT = 50;
    private const int MAXCONVERSATIONMEMBERS = 25;

    public ConversationController(MessagingAppContext db, EncryptionService encryptionService, IHubContext<ChatHub> hubContext)
    {
        this.db = db;
        this.encryptionService = encryptionService;
        this.hubContext = hubContext;
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
        
        List<User> members = await db.Users.AsNoTracking().Where(user => createConversationRequest.memberUsernames.Contains(user.username)).ToListAsync();

        if(members.Count != createConversationRequest.memberUsernames.Count)
        {
            return NotFound();
        }

        if(members.Any(user => user.id == userId))
        {
            return Forbid();
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

    [HttpGet("conversations")]
    public async Task<ActionResult<List<ConversationResult>>> GetConversations()
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        List<ConversationResult> directResults = await db.ConversationMembers.AsNoTracking().Where(member => member.userID == userId).Join(db.Conversations, member => member.conversationID, conversation => conversation.id, (member, conversation) => conversation).Where(conversation => conversation.conversationType == ConversationType.direct).Join(db.ConversationMembers, conversation => conversation.id, otherMember => otherMember.conversationID, (conversation, otherMember) => new { conversation, otherMember }).Where(x => x.otherMember.userID != userId).Join(db.Users, x => x.otherMember.userID, user => user.id, (x, user) => new ConversationResult{id = x.conversation.id, conversationName = user.displayName, iconUrl = user.profileImageUrl, conversationType = ConversationType.direct}).ToListAsync();

        List<ConversationResult> groupResults = await db.ConversationMembers.AsNoTracking().Where(member => member.userID == userId).Join(db.Conversations, member => member.conversationID, conversation => conversation.id, (member, conversation) => conversation).Where(conversation => conversation.conversationType == ConversationType.group).Join(db.Users, conversation => conversation.ownerID, user => user.id, (conversation, user) => new ConversationResult{id = conversation.id, conversationName = conversation.conversationName ?? string.Empty, iconUrl = conversation.iconUrl, conversationType = ConversationType.group, ownerUsername = user.username}).ToListAsync();

        return Ok(directResults.Concat(groupResults).ToList());
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ConversationResult>> GetConversation(long id)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        Conversation? conversation = await db.Conversations.AsNoTracking().FirstOrDefaultAsync(conversation => conversation.id == id);

        if(conversation == null)
        {
            return NotFound();
        }

        ConversationMember? conversationMember = await db.ConversationMembers.AsNoTracking().FirstOrDefaultAsync(member => member.userID == userId && member.conversationID == id);

        if(conversationMember == null)
        {
            return Forbid();
        }

        ConversationResult result = new ConversationResult();

        result.id = conversation.id;
        result.conversationType = conversation.conversationType;

        if(conversation.conversationType == ConversationType.direct)
        {
            User? otherUser = await db.ConversationMembers.AsNoTracking().Where(member => member.conversationID == id && member.userID != userId).Join(db.Users, member => member.userID, user => user.id, (member, user) => user).FirstOrDefaultAsync();
            
            if(otherUser == null)
            {
                result.conversationName = "UNKNOWN USER";
                //add default url once a path is made later in development
            }
            else
            {
                result.conversationName = otherUser.displayName;
                result.iconUrl = otherUser.profileImageUrl;
            }
        }
        else
        {
            if(conversation.conversationName == null)
            {
                result.conversationName = "UNKNOWN CONVERSATION";
            }
            else
            {
                result.conversationName = conversation.conversationName;
            }

            result.iconUrl = conversation.iconUrl;
            
            User? owner = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.id == conversation.ownerID);

            if(owner == null)
            {
                result.ownerUsername = "UNKNOWN USER";
            }
            else
            {
                result.ownerUsername = owner.username;
            }
        }

        return Ok(result);
    }
    
    [HttpGet("{id}/members")]
    public async Task<ActionResult<List<UserResult>>> GetConversationMembers(long id)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        Conversation? conversation = await db.Conversations.AsNoTracking().FirstOrDefaultAsync(conversation => conversation.id == id);

        if(conversation == null)
        {
            return NotFound();
        }

        ConversationMember? conversationMember = await db.ConversationMembers.AsNoTracking().FirstOrDefaultAsync(member => member.userID == userId && member.conversationID == id);

        if(conversationMember == null)
        {
            return Forbid();
        }

        List<UserResult> results = await db.ConversationMembers.AsNoTracking().Where(member => member.conversationID == id).Join(db.Users, member => member.userID, user => user.id, (member, user) => new UserResult{displayName = user.displayName, username = user.username, profileImageUrl = user.profileImageUrl, activityStatus = user.activityStatus, accountCreationTime = user.accountCreationTime}).ToListAsync();

        return Ok(results);
    }

    [HttpPost("{id}/members/{username}")]
    public async Task<ActionResult<UserResult>> AddUser(long id, string username)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        Conversation? conversation = await db.Conversations.AsNoTracking().FirstOrDefaultAsync(conversation => conversation.id == id);
        
        if(conversation == null)
        {
            return NotFound();
        }

        if(conversation.conversationType == ConversationType.direct)
        {
            return BadRequest("Cannot add members to a direct conversation");
        }

        if(conversation.ownerID != userId)
        {
            return Forbid();
        }

        User? foundUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.username == username);

        if(foundUser == null)
        {
            return NotFound();
        }

        ConversationMember? existingMember = await db.ConversationMembers.AsNoTracking().FirstOrDefaultAsync(member => member.conversationID == id && member.userID == foundUser.id);

        if(existingMember != null)
        {
            return Conflict("User is already a member of this conversation");
        }

        int memberCount = await db.ConversationMembers.AsNoTracking().Where(member => member.conversationID == id).CountAsync();

        if(memberCount >= MAXCONVERSATIONMEMBERS)
        {
            return BadRequest($"Conversations can only have {MAXCONVERSATIONMEMBERS} members");
        }

        ConversationMember newMember = new ConversationMember();
        newMember.conversationID = id;
        newMember.userID = foundUser.id;

        db.ConversationMembers.Add(newMember);
        await db.SaveChangesAsync();

        UserResult result = new UserResult();
        result.username = foundUser.username;
        result.displayName = foundUser.displayName;
        result.profileImageUrl = foundUser.profileImageUrl;
        result.activityStatus = foundUser.activityStatus;
        result.accountCreationTime = foundUser.accountCreationTime;

        await ChatHub.AddUserToGroup(hubContext, foundUser.id, $"conversation_{id}");
        await hubContext.Clients.Group($"conversation_{id}").SendAsync("ConversationMemberAdded", foundUser.username);

        return Ok(result);
    }

    [HttpPost("{id}/leave")]
    public async Task<IActionResult> LeaveConversation(long id)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;
        
        Conversation? conversation = await db.Conversations.FirstOrDefaultAsync(conversation => conversation.id == id);
        
        if(conversation == null)
        {
            return NotFound();
        }

        ConversationMember? member = await db.ConversationMembers.FirstOrDefaultAsync(member => member.userID == userId && member.conversationID == id);

        if(member == null)
        {
            return Forbid();
        }

        string? newOwnerUsername = null;
        bool conversationDeleted = false;

        db.ConversationMembers.Remove(member);

        if(conversation.conversationType == ConversationType.direct)
        {
            ConversationMember? foundMember = await db.ConversationMembers.AsNoTracking().FirstOrDefaultAsync(member => member.conversationID == id && member.userID != userId);

            if(foundMember == null)
            {
                conversationDeleted = true;
                db.Conversations.Remove(conversation);
            }
        }
        else
        {
            if(conversation.ownerID == userId)
            {
                ConversationMember? foundMember = await db.ConversationMembers.AsNoTracking().FirstOrDefaultAsync(member => member.conversationID == id && member.userID != userId);

                if(foundMember == null)
                {
                    conversationDeleted = true;
                    db.Conversations.Remove(conversation);
                }
                else
                {
                    conversation.ownerID = foundMember.userID;
                    newOwnerUsername = await db.Users.AsNoTracking().Where(user => user.id == foundMember.userID).Select(user => user.username).FirstOrDefaultAsync();
                }
            }
        }

        await db.SaveChangesAsync();

        if(conversationDeleted)
        {
            await ChatHub.RemoveUserFromGroup(hubContext, userId, $"conversation_{id}");
            return NoContent();
        }

        if(newOwnerUsername != null)
            await hubContext.Clients.Group($"conversation_{id}").SendAsync("ConversationOwnerChanged", newOwnerUsername);

        await hubContext.Clients.Group($"conversation_{id}").SendAsync("ConversationMemberLeft", GetUsername());
        await ChatHub.RemoveUserFromGroup(hubContext, userId, $"conversation_{id}");

        return NoContent();
    }

    [HttpGet("{id}/messages")]
    public async Task<ActionResult<List<MessageResult>>> GetMessages(long id, [FromQuery] long? before = null)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        Conversation? foundConversation = await db.Conversations.AsNoTracking().FirstOrDefaultAsync(conversation => conversation.id == id);

        if(foundConversation == null)
        {
            return NotFound();
        }

        ConversationMember? foundMember = await db.ConversationMembers.AsNoTracking().FirstOrDefaultAsync(member => member.conversationID == id && member.userID == userId);

        if(foundMember == null)
        {
            return Forbid();
        }

        IQueryable<ConversationMessage> messageQuery = db.ConversationMessages.Where(message => message.conversationID == id);

        if(before != null)
        {
            messageQuery = messageQuery.Where(message => message.id < before);
        }

        List<MessageResult> results = await messageQuery.OrderByDescending(message => message.id).Take(MESSAGEGRABAMOUNT).Join(db.Users, message => message.sender, user => user.id, (message, user) => new MessageResult{id = message.id, messageText = encryptionService.Decrypt(message.messageText), senderUsername = user.username, edited = message.edited, timeSent = message.timeSent, replyToID = message.replyToID}).ToListAsync();

        return Ok(results);
    }

    [HttpPost("{id}/sendmessage")]
    public async Task<ActionResult<SendMessageResult>> SendMessage(long id, SendMessageRequest sendMessageRequest)
    {
        if(string.IsNullOrWhiteSpace(sendMessageRequest.messageText))
        {
            return BadRequest("Invalid message text");
        }

        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        Conversation? foundConversation = await db.Conversations.AsNoTracking().FirstOrDefaultAsync(conversation => conversation.id == id);

        if(foundConversation == null)
        {
            return NotFound();
        }

        ConversationMember? foundMember = await db.ConversationMembers.AsNoTracking().FirstOrDefaultAsync(member => member.conversationID == id && member.userID == userId);

        if(foundMember == null)
        {
            return Forbid();
        }

        ConversationMessage newMessage = new ConversationMessage();

        newMessage.messageText = encryptionService.Encrypt(sendMessageRequest.messageText);
        newMessage.conversationID = id;
        newMessage.sender = userId;

        if(sendMessageRequest.replyToID != null)
        {
            bool replyExists = await db.ConversationMessages.AnyAsync(message => message.id == sendMessageRequest.replyToID && message.conversationID == id);

            if(!replyExists)
            {
                return BadRequest("Reply target message not found");
            }

            newMessage.replyToID = sendMessageRequest.replyToID;
        }

        db.ConversationMessages.Add(newMessage);

        await db.SaveChangesAsync();

        string? username = GetUsername();

        if(username == null)
            username = string.Empty;

        SendMessageResult result = new SendMessageResult();
        result.id = newMessage.id;
        result.messageText = sendMessageRequest.messageText;
        result.senderUsername = username;
        result.timeSent = newMessage.timeSent;
        result.replyToID = newMessage.replyToID;

        await hubContext.Clients.Group($"conversation_{id}").SendAsync("ReceiveConversationMessage", result);

        return Ok(result);
    }
}