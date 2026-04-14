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
public class ChannelController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly EncryptionService encryptionService;
    private readonly IHubContext<ChatHub> hubContext;
    private const int MESSAGEGRABAMOUNT = 50;

    public ChannelController(MessagingAppContext db, EncryptionService encryptionService, IHubContext<ChatHub> hubContext)
    {
        this.db = db;
        this.encryptionService = encryptionService;
        this.hubContext = hubContext;
    }

    [HttpPut("{id}")]
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

    [HttpDelete("{id}")]
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

        db.Channels.Remove(foundChannel);

        await db.SaveChangesAsync();

        //cleans up the order of channels
        List<Channel> remainingChannels = await db.Channels.Where(channel => channel.serverID == foundChannel.serverID).OrderBy(channel => channel.channelOrder).ToListAsync();

        for (int i = 0; i < remainingChannels.Count; i++)
        {
            remainingChannels[i].channelOrder = i;
        }

        await db.SaveChangesAsync();

        await hubContext.Clients.Group($"server_{foundServer.id}").SendAsync("ChannelDeleted", foundChannel.id);

        return NoContent();
    }

    [HttpGet("{id}/messages")]
    public async Task<ActionResult<List<MessageResult>>> GetMessages(long id, [FromQuery] long? before = null)
    {
        long? userId = GetUserId();

        if(userId == null)
        {
            return Unauthorized();
        }

        Channel? foundChannel = await db.Channels.AsNoTracking().FirstOrDefaultAsync(channel => channel.id == id);

        if(foundChannel == null)
        {
            return NotFound();
        }

        //ensures the user is a member of the server
        ServerMember? foundMember = await db.ServerMembers.AsNoTracking().FirstOrDefaultAsync(member => member.serverID == foundChannel.serverID && member.userID == userId);

        if(foundMember == null)
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

        Channel? foundChannel = await db.Channels.AsNoTracking().FirstOrDefaultAsync(channel => channel.id == id);

        if(foundChannel == null)
        {
            return NotFound();
        }

        ServerMember? foundMember = await db.ServerMembers.AsNoTracking().FirstOrDefaultAsync(member => member.serverID == foundChannel.serverID && member.userID == userId);

        if(foundMember == null)
        {
            return Forbid();
        }

        Message newMessage = new Message();

        newMessage.messageText = encryptionService.Encrypt(sendMessageRequest.messageText);
        newMessage.channelID = id;
        newMessage.sender = userId;

        //checks if the message is replying to another message
        if(sendMessageRequest.replyToID != null)
        {
            //makes sure message is apart of the server
            bool replyExists = await db.Messages.AnyAsync(message => message.id == sendMessageRequest.replyToID && message.channelID == id);

            if(!replyExists)
            {
                return BadRequest("Reply target message not found");
            }

            newMessage.replyToID = sendMessageRequest.replyToID;
        }

        db.Messages.Add(newMessage);

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

        await hubContext.Clients.Group($"server_{foundChannel.serverID}").SendAsync("ReceiveChannelMessage", foundChannel.serverID, result);

        return Ok(result);
    }
}