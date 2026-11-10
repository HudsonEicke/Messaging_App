using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Data;
using Messaging_App.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Messaging_App.Hubs;

namespace Messaging_App.Controllers;

[Authorize]
[ApiController]
[Route("conversations")]
public class ConversationController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly EncryptionService encryptionService;
    
    private readonly IHubContext<ChatHub> hubContext;
    private readonly HubGroupService hubGroupService;
    private readonly PresenceService presenceService;
    private readonly ReadStateService readStateService;
    private const int MESSAGEGRABAMOUNT = 50;
    private const int MAXCONVERSATIONMEMBERS = 25;
    private const int MAXUNREADCOUNT = 100;
    private const int MAXCONVERSATIONNAMELENGTH = 100;

    public ConversationController(MessagingAppContext db, EncryptionService encryptionService, IHubContext<ChatHub> hubContext, ReadStateService readStateService, HubGroupService hubGroupService, PresenceService presenceService)
    {
        this.db = db;
        this.presenceService = presenceService;
        this.encryptionService = encryptionService;
        this.hubContext = hubContext;
        this.hubGroupService = hubGroupService;
        this.readStateService = readStateService;
    }

    private static CreateConversationResult CreateDirectResult(long conversationId, User creatingUser, User otherUser)
    {
        CreateConversationResult result = new CreateConversationResult();
        result.conversationID = conversationId;
        result.conversationName = otherUser.displayName;
        result.iconUrl = otherUser.profileImageUrl;
        result.conversationType = ConversationType.direct;
        result.otherUsername = otherUser.username;
        result.memberUsernames = new List<string> { creatingUser.username, otherUser.username };
        return result;
    }

    private async Task<ConversationResult> BuildConversationResult(Conversation conversation, long userId)
    {
        ConversationResult result = new ConversationResult();

        result.id = conversation.id;
        result.conversationType = conversation.conversationType;

        if(conversation.conversationType == ConversationType.direct)
        {
            //the pair columns still name the other user after they leave, unlike the members table
            long? otherUserId = conversation.directUserLowID == userId ? conversation.directUserHighID : conversation.directUserLowID;
            User? otherUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.id == otherUserId);
            
            if(otherUser == null)
            {
                result.conversationName = "UNKNOWN USER";
                //add default url once a path is made later in development
            }
            else
            {
                result.conversationName = otherUser.displayName;
                result.iconUrl = otherUser.profileImageUrl;
                result.otherUsername = otherUser.username;
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

        result.lastMessageID = await db.ConversationMessages.AsNoTracking().Where(message => message.conversationID == conversation.id).MaxAsync(message => (long?)message.id);

        long? lastReadMessageID = await db.ConversationMembers.AsNoTracking().Where(member => member.conversationID == conversation.id && member.userID == userId).Select(member => member.lastReadMessageID).FirstOrDefaultAsync();

        result.unreadCount = await db.ConversationMessages.AsNoTracking().Where(message => message.conversationID == conversation.id && message.id > (lastReadMessageID ?? 0)).Take(MAXUNREADCOUNT).CountAsync();

        return result;
    }

    //sent to every connection the user has, since a new conversation isn't in any of their groups yet
    private async Task SendConversationCreated(Conversation conversation, long userId)
    {
        ConversationResult result = await BuildConversationResult(conversation, userId);

        await hubContext.Clients.User(userId.ToString()).SendAsync("ConversationCreated", result);
    }

    //puts someone back in a dm they closed, read up to the latest message so old messages don't come back as unread
    //returns false if they were already a member, which also covers two requests adding them at once
    private async Task<bool> RejoinDirectConversation(long conversationId, long userId)
    {
        int addedRows = await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO conversationmembers (conversationid, userid, lastreadmessageid) SELECT {conversationId}, {userId}, MAX(id) FROM conversationmessages WHERE conversationid = {conversationId} ON CONFLICT DO NOTHING");

        return addedRows == 1;
    }

    [HttpPost]
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

            long directUserLowID = Math.Min(userId, otherUser.id);
            long directUserHighID = Math.Max(userId, otherUser.id);

            Conversation? existingConversation = await db.Conversations.AsNoTracking().FirstOrDefaultAsync(conversation => conversation.conversationType == ConversationType.direct && conversation.directUserLowID == directUserLowID && conversation.directUserHighID == directUserHighID);

            if(existingConversation != null)
            {
                //get-or-create: an open dm is returned as is, and if you had closed it you're added back
                //the other person only comes back when a message is sent, so opening a dm doesn't reappear for them
                if(await RejoinDirectConversation(existingConversation.id, userId))
                {
                    await hubGroupService.AddUserToGroup(userId, $"conversation_{existingConversation.id}");
                    await SendConversationCreated(existingConversation, userId);
                }

                return Ok(CreateDirectResult(existingConversation.id, creatingUser, otherUser));
            }

            newConversation = new Conversation();
            newConversation.conversationType = ConversationType.direct;
            newConversation.directUserLowID = directUserLowID;
            newConversation.directUserHighID = directUserHighID;

            //conversationID is filled in by EF when the conversation is inserted
            ConversationMember newConversationMember1 = new ConversationMember();
            newConversationMember1.userID = userId;
            newConversation.members.Add(newConversationMember1);

            ConversationMember newConversationMember2 = new ConversationMember();
            newConversationMember2.userID = otherUser.id;
            newConversation.members.Add(newConversationMember2);

            db.Conversations.Add(newConversation);
            try
            {
                await db.SaveChangesAsync();
            }
            catch(DbUpdateException exception) when (exception.IsUniqueViolation("idx_conversations_direct_pair"))
            {
                //the other user created the same dm at the same moment, so return theirs
                long createdConversationId = await db.Conversations.AsNoTracking().Where(conversation => conversation.conversationType == ConversationType.direct && conversation.directUserLowID == directUserLowID && conversation.directUserHighID == directUserHighID).Select(conversation => conversation.id).FirstAsync();

                return Ok(CreateDirectResult(createdConversationId, creatingUser, otherUser));
            }

            //adds both users' live connections so messages in the new dm arrive without reconnecting
            await hubGroupService.AddUserToGroup(userId, $"conversation_{newConversation.id}");
            await hubGroupService.AddUserToGroup(otherUser.id, $"conversation_{newConversation.id}");

            await SendConversationCreated(newConversation, userId);
            await SendConversationCreated(newConversation, otherUser.id);

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
            //the generated name can be longer than the 100 character column when there are many members, so it's trimmed
            string generatedName = string.Join(", ", new[] { creatingUser.displayName }.Concat(members.Select(user => user.displayName)));
            newConversation.conversationName = generatedName.Length <= MAXCONVERSATIONNAMELENGTH ? generatedName : generatedName.Substring(0, MAXCONVERSATIONNAMELENGTH - 3) + "...";
        }
        else
        {
            newConversation.conversationName = createConversationRequest.conversationName;
        }

        //conversationID is filled in by EF when the conversation is inserted
        ConversationMember newMember = new ConversationMember();
        newMember.userID = userId;
        newConversation.members.Add(newMember);

        foreach(User user in members)
        {
            newMember = new ConversationMember();
            newMember.userID = user.id;
            newConversation.members.Add(newMember);
        }

        db.Conversations.Add(newConversation);

        await db.SaveChangesAsync();

        //adds every member's live connections so messages in the new group arrive without reconnecting
        foreach(ConversationMember member in newConversation.members)
        {
            await hubGroupService.AddUserToGroup(member.userID, $"conversation_{newConversation.id}");
        }

        //a group looks the same to every member, so one result goes to the whole group
        ConversationResult createdResult = await BuildConversationResult(newConversation, userId);
        await hubContext.Clients.Group($"conversation_{newConversation.id}").SendAsync("ConversationCreated", createdResult);

        result = new CreateConversationResult();
        result.conversationID = newConversation.id;
        result.conversationName = newConversation.conversationName;
        result.ownerUsername = creatingUser.username;
        result.conversationType = ConversationType.group;
        result.iconUrl = newConversation.iconUrl;
        result.memberUsernames = createConversationRequest.memberUsernames.Append(creatingUser.username).ToList();

        return Ok(result);
    }

    [HttpGet]
    public async Task<ActionResult<List<ConversationResult>>> GetConversations()
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        List<ConversationResult> directResults = await db.ConversationMembers.AsNoTracking().Where(member => member.userID == userId).Join(db.Conversations, member => member.conversationID, conversation => conversation.id, (member, conversation) => new { member, conversation }).Where(membership => membership.conversation.conversationType == ConversationType.direct).Join(db.Users, membership => membership.conversation.directUserLowID == userId ? membership.conversation.directUserHighID : membership.conversation.directUserLowID, user => (long?)user.id, (membership, user) => new ConversationResult{id = membership.conversation.id, conversationName = user.displayName, iconUrl = user.profileImageUrl, otherUsername = user.username, conversationType = ConversationType.direct, lastMessageID = db.ConversationMessages.Where(message => message.conversationID == membership.conversation.id).Max(message => (long?)message.id), unreadCount = db.ConversationMessages.Where(message => message.conversationID == membership.conversation.id && message.id > (membership.member.lastReadMessageID ?? 0)).Take(MAXUNREADCOUNT).Count()}).ToListAsync();

        List<ConversationResult> groupResults = await db.ConversationMembers.AsNoTracking().Where(member => member.userID == userId).Join(db.Conversations, member => member.conversationID, conversation => conversation.id, (member, conversation) => new { member, conversation }).Where(membership => membership.conversation.conversationType == ConversationType.group).Join(db.Users, membership => membership.conversation.ownerID, user => user.id, (membership, user) => new ConversationResult{id = membership.conversation.id, conversationName = membership.conversation.conversationName ?? string.Empty, iconUrl = membership.conversation.iconUrl, conversationType = ConversationType.group, ownerUsername = user.username, lastMessageID = db.ConversationMessages.Where(message => message.conversationID == membership.conversation.id).Max(message => (long?)message.id), unreadCount = db.ConversationMessages.Where(message => message.conversationID == membership.conversation.id && message.id > (membership.member.lastReadMessageID ?? 0)).Take(MAXUNREADCOUNT).Count()}).ToListAsync();

        //most recently active first, conversations with no messages go last
        List<ConversationResult> results = directResults.Concat(groupResults).OrderByDescending(conversation => conversation.lastMessageID ?? 0).ThenByDescending(conversation => conversation.id).ToList();

        return Ok(results);
    }

    [HttpGet("{id:long}")]
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

        return Ok(await BuildConversationResult(conversation, userId));
    }
    
    [HttpPatch("{id:long}")]
    public async Task<IActionResult> UpdateConversation(long id, UpdateConversationRequest updateConversationRequest)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        Conversation? foundConversation = await db.Conversations.FirstOrDefaultAsync(conversation => conversation.id == id);

        if(foundConversation == null)
        {
            return NotFound();
        }

        if(foundConversation.conversationType == ConversationType.direct)
        {
            return BadRequest();
        }

        ConversationMember? isMember = await db.ConversationMembers.AsNoTracking().FirstOrDefaultAsync(member => member.conversationID == id && member.userID == userId);

        if(isMember == null)
        {
            return Forbid();
        }

        if(updateConversationRequest.conversationName != null)
        {
            string trimmed = updateConversationRequest.conversationName.Trim();

            if(!string.IsNullOrWhiteSpace(trimmed))
            {
                foundConversation.conversationName = trimmed;
            }
        }

        if(updateConversationRequest.iconUrl != null)
        {
            foundConversation.iconUrl = updateConversationRequest.iconUrl;
        }

        await db.SaveChangesAsync();

        await hubContext.Clients.Group($"conversation_{id}").SendAsync("ConversationUpdated", id, foundConversation.conversationName, foundConversation.iconUrl);

        return NoContent();
    }

    [HttpGet("{id:long}/members")]
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

        List<UserResult> results = await db.ConversationMembers.AsNoTracking().Where(member => member.conversationID == id).Join(db.Users, member => member.userID, user => user.id, (member, user) => new UserResult{displayName = user.displayName, username = user.username, profileImageUrl = user.profileImageUrl, activityStatus = presenceService.GetDisplayedStatus(user.id, user.activityStatus), accountCreationTime = user.accountCreationTime}).ToListAsync();

        return Ok(results);
    }

    [HttpPost("{id:long}/members")]
    public async Task<ActionResult<UserResult>> AddUser(long id, AddConversationMemberRequest addMemberRequest)
    {
        if(string.IsNullOrWhiteSpace(addMemberRequest.username))
        {
            return BadRequest("Username is required");
        }

        string username = addMemberRequest.username;

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

        //starts the new member at the latest message so they don't join with old messages as unread
        newMember.lastReadMessageID = await db.ConversationMessages.Where(message => message.conversationID == id).MaxAsync(message => (long?)message.id);

        db.ConversationMembers.Add(newMember);
        await db.SaveChangesAsync();

        UserResult result = new UserResult();
        result.username = foundUser.username;
        result.displayName = foundUser.displayName;
        result.profileImageUrl = foundUser.profileImageUrl;
        result.activityStatus = presenceService.GetDisplayedStatus(foundUser.id, foundUser.activityStatus);
        result.accountCreationTime = foundUser.accountCreationTime;

        await hubGroupService.AddUserToGroup(foundUser.id, $"conversation_{id}");
        await SendConversationCreated(conversation, foundUser.id);
        await hubContext.Clients.Group($"conversation_{id}").SendAsync("ConversationMemberAdded", id, result);

        return Ok(result);
    }

    [HttpDelete("{id:long}/members/me")]
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
            await hubGroupService.RemoveUserFromGroup(userId, $"conversation_{id}");
            return NoContent();
        }

        if(newOwnerUsername != null)
            await hubContext.Clients.Group($"conversation_{id}").SendAsync("ConversationOwnerChanged", id, newOwnerUsername);

        await hubContext.Clients.Group($"conversation_{id}").SendAsync("ConversationMemberLeft", id, GetUsername());
        await hubGroupService.RemoveUserFromGroup(userId, $"conversation_{id}");

        return NoContent();
    }

    [HttpGet("{id:long}/messages")]
    public async Task<ActionResult<List<MessageResult>>> GetMessages(long id, [FromQuery] long? before = null)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        bool? isMember = await db.Conversations.Where(conversation => conversation.id == id).Select(conversation => (bool?)db.ConversationMembers.Any(member => member.conversationID == conversation.id && member.userID == userId)).FirstOrDefaultAsync();

        if(isMember == null)
        {
            return NotFound();
        }

        if(isMember == false)
        {
            return Forbid();
        }

        IQueryable<ConversationMessage> messageQuery = db.ConversationMessages.Where(message => message.conversationID == id);

        if(before != null)
        {
            messageQuery = messageQuery.Where(message => message.id < before);
        }

        List<MessageResult> results = await messageQuery.OrderByDescending(message => message.id).Take(MESSAGEGRABAMOUNT).Join(db.Users, message => message.sender, user => user.id, (message, user) => new MessageResult{id = message.id, messageText = encryptionService.Decrypt(message.messageText), senderUsername = user.username, senderDisplayName = user.displayName, senderProfileImageUrl = user.profileImageUrl, edited = message.edited, timeSent = message.timeSent, replyToID = message.replyToID}).ToListAsync();

        List<long> replyIds = results.Where(result => result.replyToID != null).Select(result => result.replyToID!.Value).Distinct().ToList();

        //decrypting can't run in the database, so the originals are loaded in a second query
        if (replyIds.Count > 0)
        {
            List<MessageReplyPreview> previews = await db.ConversationMessages.AsNoTracking().Where(message => replyIds.Contains(message.id)).Join(db.Users, message => message.sender, user => user.id, (message, user) => new MessageReplyPreview{id = message.id, messageText = message.messageText, senderUsername = user.username, senderDisplayName = user.displayName, senderProfileImageUrl = user.profileImageUrl}).ToListAsync();

            foreach (MessageReplyPreview preview in previews)
            {
                preview.messageText = ShortenReplyPreview(encryptionService.Decrypt(preview.messageText));
            }

            Dictionary<long, MessageReplyPreview> previewsById = previews.ToDictionary(preview => preview.id);

            foreach (MessageResult result in results)
            {
                if (result.replyToID != null && previewsById.TryGetValue(result.replyToID.Value, out MessageReplyPreview? preview))
                {
                    result.replyTo = preview;
                }
            }
        }

        return Ok(results);
    }

    [HttpPost("{id:long}/messages")]
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

        Conversation? conversation = await db.Conversations.AsNoTracking().FirstOrDefaultAsync(conversation => conversation.id == id);

        if(conversation == null)
        {
            return NotFound();
        }

        bool isMember = await db.ConversationMembers.AsNoTracking().AnyAsync(member => member.conversationID == id && member.userID == userId);

        if(!isMember)
        {
            return Forbid();
        }

        ConversationMessage newMessage = new ConversationMessage();

        newMessage.messageText = encryptionService.Encrypt(sendMessageRequest.messageText);
        newMessage.conversationID = id;
        newMessage.sender = userId;

        MessageReplyPreview? replyPreview = null;

        if(sendMessageRequest.replyToID != null)
        {
            replyPreview = await db.ConversationMessages.AsNoTracking().Where(message => message.id == sendMessageRequest.replyToID && message.conversationID == id).Join(db.Users, message => message.sender, user => user.id, (message, user) => new MessageReplyPreview{id = message.id, messageText = message.messageText, senderUsername = user.username, senderDisplayName = user.displayName, senderProfileImageUrl = user.profileImageUrl}).FirstOrDefaultAsync();

            if(replyPreview == null)
            {
                return BadRequest("Reply target message not found");
            }

            replyPreview.messageText = ShortenReplyPreview(encryptionService.Decrypt(replyPreview.messageText));
            newMessage.replyToID = sendMessageRequest.replyToID;
        }

        long? rejoinedUserId = null;

        //if the other person closed the dm, this message brings it back for them; done before saving the message so only it is unread
        if(conversation.conversationType == ConversationType.direct)
        {
            long? otherUserId = conversation.directUserLowID == userId ? conversation.directUserHighID : conversation.directUserLowID;

            if(otherUserId != null && await RejoinDirectConversation(id, otherUserId.Value))
            {
                rejoinedUserId = otherUserId;
            }
        }

        db.ConversationMessages.Add(newMessage);

        await db.SaveChangesAsync();

        //the sender has read their own message
        await readStateService.MarkConversationRead(id, userId, newMessage.id);

        string? username = GetUsername();

        if(username == null)
            username = string.Empty;

        User? sender = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.id == userId);

        SendMessageResult result = new SendMessageResult();
        result.id = newMessage.id;
        result.messageText = sendMessageRequest.messageText;
        result.senderUsername = username;
        result.senderDisplayName = sender?.displayName ?? username;
        result.senderProfileImageUrl = sender?.profileImageUrl ?? string.Empty;
        result.timeSent = newMessage.timeSent;
        result.replyToID = newMessage.replyToID;
        result.replyTo = replyPreview;

        //they get the conversation first so the message has somewhere to go
        if(rejoinedUserId != null)
        {
            await hubGroupService.AddUserToGroup(rejoinedUserId.Value, $"conversation_{id}");
            await SendConversationCreated(conversation, rejoinedUserId.Value);
        }

        await hubContext.Clients.Group($"conversation_{id}").SendAsync("ReceiveConversationMessage", id, result);

        return Ok(result);
    }

    [HttpPut("{id:long}/read-state")]
    public async Task<IActionResult> UpdateReadState(long id, UpdateReadStateRequest updateReadStateRequest)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        bool? isMember = await db.Conversations.Where(conversation => conversation.id == id).Select(conversation => (bool?)db.ConversationMembers.Any(member => member.conversationID == conversation.id && member.userID == userId)).FirstOrDefaultAsync();

        if(isMember == null)
        {
            return NotFound();
        }

        if(isMember == false)
        {
            return Forbid();
        }

        //stops a made up id from hiding future unread messages
        bool messageExists = await db.ConversationMessages.AnyAsync(message => message.id == updateReadStateRequest.lastReadMessageID && message.conversationID == id);

        if(!messageExists)
        {
            return BadRequest("Message not found in this conversation");
        }

        await readStateService.MarkConversationRead(id, userId, updateReadStateRequest.lastReadMessageID);

        //worked out after saving, so the user's other tabs get the real count even if a newer message arrived meanwhile
        int unreadCount = await readStateService.GetConversationUnreadCount(id, userId, MAXUNREADCOUNT);

        await hubContext.Clients.User(userId.ToString()).SendAsync("ConversationReadStateUpdated", id, unreadCount);

        return NoContent();
    }
}