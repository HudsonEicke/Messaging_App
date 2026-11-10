using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Messaging_App.Data;
using Messaging_App.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Messaging_App.Hubs;

namespace Messaging_App.Controllers;

[Authorize]
[ApiController]
[Route("channels")]
public class ChannelController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly EncryptionService encryptionService;
    private readonly IHubContext<ChatHub> hubContext;
    private readonly ReadStateService readStateService;
    private const int MESSAGEGRABAMOUNT = 50;

    public ChannelController(MessagingAppContext db, EncryptionService encryptionService, IHubContext<ChatHub> hubContext, ReadStateService readStateService)
    {
        this.db = db;
        this.encryptionService = encryptionService;
        this.hubContext = hubContext;
        this.readStateService = readStateService;
    }

    [HttpPatch("{id:long}")]
    public async Task<IActionResult> UpdateChannel(long id, UpdateChannelRequest updateChannelRequest)
    {
        if(string.IsNullOrWhiteSpace(updateChannelRequest.channelName))
        {
            return BadRequest("Invalid channel name");
        }

        long? nullableUserId = GetUserId();

        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        Channel? foundChannel = await db.Channels.FirstOrDefaultAsync(channel => channel.id == id);

        if(foundChannel == null)
        {
            return NotFound();
        }

        Server? foundServer = await db.Servers.AsNoTracking().FirstOrDefaultAsync(server => server.id == foundChannel.serverID);

        if(foundServer == null)
        {
            return NotFound();
        }

        if(foundServer.ownerID != userId)
        {
            return Forbid();
        }

        foundChannel.channelName = updateChannelRequest.channelName.Trim();

        await db.SaveChangesAsync();

        await hubContext.Clients.Group($"server_{foundServer.id}").SendAsync("ChannelUpdated", foundChannel.id, foundChannel.channelName);

        return NoContent();
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> DeleteChannel(long id)
    {
        long? userId = GetUserId();

        if(userId == null)
        {
            return Unauthorized();
        }

        Channel? foundChannel = await db.Channels.FirstOrDefaultAsync(channel => channel.id == id);

        if(foundChannel == null)
        {
            return NotFound();
        }

        Server? foundServer = await db.Servers.AsNoTracking().FirstOrDefaultAsync(server => server.id == foundChannel.serverID);

        if(foundServer == null)
        {
            return NotFound();
        }

        if(foundServer.ownerID != userId)
        {
            return Forbid();
        }

        await using IDbContextTransaction transaction = await db.Database.BeginTransactionAsync();
        await db.LockServerAsync(foundChannel.serverID);

        //cleans up the order of the other channels so the delete and reorder save together
        List<Channel> remainingChannels = await db.Channels.Where(channel => channel.serverID == foundChannel.serverID && channel.id != foundChannel.id).OrderBy(channel => channel.channelOrder).ToListAsync();

        for (int i = 0; i < remainingChannels.Count; i++)
        {
            remainingChannels[i].channelOrder = i;
        }

        db.Channels.Remove(foundChannel);

        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        await hubContext.Clients.Group($"server_{foundServer.id}").SendAsync("ChannelDeleted", foundChannel.id);

        return NoContent();
    }

    [HttpGet("{id:long}/messages")]
    public async Task<ActionResult<List<MessageResult>>> GetMessages(long id, [FromQuery] long? before = null)
    {
        long? userId = GetUserId();

        if(userId == null)
        {
            return Unauthorized();
        }

        //one query: null means the channel doesn't exist, false means the user isn't in its server
        bool? isMember = await db.Channels.Where(channel => channel.id == id).Select(channel => (bool?)db.ServerMembers.Any(member => member.serverID == channel.serverID && member.userID == userId)).FirstOrDefaultAsync();

        if(isMember == null)
        {
            return NotFound();
        }

        if(isMember == false)
        {
            return Forbid();
        }

        //builds the query for getting messages
        IQueryable<Message> messageQuery = db.Messages.Where(message => message.channelID == id);

        //will grab messages before specified id
        if(before != null)
        {
            messageQuery = messageQuery.Where(message => message.id < before);
        }

        List<MessageResult> results = await messageQuery.OrderByDescending(message => message.id).Take(MESSAGEGRABAMOUNT).Join(db.Users, message => message.sender, user => user.id, (message, user) => new MessageResult{id = message.id, messageText = encryptionService.Decrypt(message.messageText), senderUsername = user.username, senderDisplayName = user.displayName, senderProfileImageUrl = user.profileImageUrl, edited = message.edited, timeSent = message.timeSent, replyToID = message.replyToID}).ToListAsync();

        List<long> replyIds = results.Where(result => result.replyToID != null).Select(result => result.replyToID!.Value).Distinct().ToList();

        //decrypting can't run in the database, so the originals are loaded in a second query
        if (replyIds.Count > 0)
        {
            List<MessageReplyPreview> previews = await db.Messages.AsNoTracking().Where(message => replyIds.Contains(message.id)).Join(db.Users, message => message.sender, user => user.id, (message, user) => new MessageReplyPreview{id = message.id, messageText = message.messageText, senderUsername = user.username, senderDisplayName = user.displayName, senderProfileImageUrl = user.profileImageUrl}).ToListAsync();

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

        Channel? foundChannel = await db.Channels.AsNoTracking().FirstOrDefaultAsync(channel => channel.id == id);

        if(foundChannel == null)
        {
            return NotFound();
        }

        //checks membership and gets the sender in one query, null means they aren't in the server
        User? sender = await db.ServerMembers.AsNoTracking().Where(member => member.serverID == foundChannel.serverID && member.userID == userId).Join(db.Users, member => member.userID, user => user.id, (member, user) => user).FirstOrDefaultAsync();

        if(sender == null)
        {
            return Forbid();
        }

        Message newMessage = new Message();

        newMessage.messageText = encryptionService.Encrypt(sendMessageRequest.messageText);
        newMessage.channelID = id;
        newMessage.sender = userId;

        MessageReplyPreview? replyPreview = null;

        //checks if the message is replying to another message
        if(sendMessageRequest.replyToID != null)
        {
            //makes sure message is apart of the server
            replyPreview = await db.Messages.AsNoTracking().Where(message => message.id == sendMessageRequest.replyToID && message.channelID == id).Join(db.Users, message => message.sender, user => user.id, (message, user) => new MessageReplyPreview{id = message.id, messageText = message.messageText, senderUsername = user.username, senderDisplayName = user.displayName, senderProfileImageUrl = user.profileImageUrl}).FirstOrDefaultAsync();

            if(replyPreview == null)
            {
                return BadRequest("Reply target message not found");
            }

            replyPreview.messageText = ShortenReplyPreview(encryptionService.Decrypt(replyPreview.messageText));
            newMessage.replyToID = sendMessageRequest.replyToID;
        }

        db.Messages.Add(newMessage);

        await db.SaveChangesAsync();

        //the sender has read their own message
        await readStateService.MarkChannelRead(id, userId, newMessage.id);

        string? username = GetUsername();

        if(username == null)
            username = string.Empty;

        SendMessageResult result = new SendMessageResult();
        result.id = newMessage.id;
        result.messageText = sendMessageRequest.messageText;
        result.senderUsername = username;
        result.senderDisplayName = sender.displayName;
        result.senderProfileImageUrl = sender.profileImageUrl;
        result.timeSent = newMessage.timeSent;
        result.replyToID = newMessage.replyToID;
        result.replyTo = replyPreview;

        await hubContext.Clients.Group($"server_{foundChannel.serverID}").SendAsync("ReceiveChannelMessage", foundChannel.serverID, foundChannel.id, result);

        return Ok(result);
    }

    [HttpPut("{id:long}/read-state")]
    public async Task<IActionResult> UpdateReadState(long id, UpdateReadStateRequest updateReadStateRequest)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        //the server id is needed for the event, so this doesn't use the one-query membership check
        long? nullableServerId = await db.Channels.AsNoTracking().Where(channel => channel.id == id).Select(channel => (long?)channel.serverID).FirstOrDefaultAsync();

        if(nullableServerId == null)
        {
            return NotFound();
        }

        long serverId = nullableServerId.Value;

        bool isMember = await db.ServerMembers.AsNoTracking().AnyAsync(member => member.serverID == serverId && member.userID == userId);

        if(!isMember)
        {
            return Forbid();
        }

        //stops a made up id from hiding future unread messages
        bool messageExists = await db.Messages.AnyAsync(message => message.id == updateReadStateRequest.lastReadMessageID && message.channelID == id);

        if(!messageExists)
        {
            return BadRequest("Message not found in this channel");
        }

        await readStateService.MarkChannelRead(id, userId, updateReadStateRequest.lastReadMessageID);

        //worked out after saving, so the user's other tabs get the real state even if a newer message arrived meanwhile
        bool channelHasUnread = await readStateService.ChannelHasUnread(id, userId);
        bool serverHasUnread = await readStateService.ServerHasUnread(serverId, userId);

        await hubContext.Clients.User(userId.ToString()).SendAsync("ChannelReadStateUpdated", serverId, id, channelHasUnread, serverHasUnread);

        return NoContent();
    }
}