using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;
using Messaging_App.Data;
using Messaging_App.Services;
using Microsoft.AspNetCore.Authorization;

namespace Messaging_App.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class ChannelController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly EncryptionService encryptionService;
    private const int MESSAGEGRABAMOUNT = 50;

    public ChannelController(MessagingAppContext db, EncryptionService encryptionService)
    {
        this.db = db;
        this.encryptionService = encryptionService;
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

        List<Channel> remainingChannels = await db.Channels.Where(channel => channel.serverID == foundChannel.serverID).OrderBy(channel => channel.channelOrder).ToListAsync();

        for (int i = 0; i < remainingChannels.Count; i++)
        {
            remainingChannels[i].channelOrder = i;
        }

        await db.SaveChangesAsync();

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

        ServerMember? foundMember = await db.ServerMembers.AsNoTracking().FirstOrDefaultAsync(member => member.serverID == foundChannel.serverID && member.userID == userId);

        if(foundMember == null)
        {
            return Forbid();
        }

        IQueryable<Message> messageQuery = db.Messages.Where(message => message.channelID == id);

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

        if(sendMessageRequest.replyToID != null)
        {
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

        return Ok(result);
    }
}