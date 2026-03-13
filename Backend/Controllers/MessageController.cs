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
public class MessageController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly EncryptionService encryptionService;

    public MessageController(MessagingAppContext db, EncryptionService encryptionService)
    {
        this.db = db;
        this.encryptionService = encryptionService;
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> EditMessage(long id, EditMessageRequest editMessageRequest)
    {
        if(string.IsNullOrWhiteSpace(editMessageRequest.messageText))
        {
            return BadRequest("Invalid message text");
        }

        long? userId = GetUserId();

        if(userId == null)
        {
            return Unauthorized();
        }

        Message? foundMessage = await db.Messages.FirstOrDefaultAsync(message => message.id == id);

        if(foundMessage == null)
        {
            return NotFound();
        }

        if(foundMessage.sender != userId)
        {
            return Forbid();
        }

        //checks if the message is the same already
        if(encryptionService.Decrypt(foundMessage.messageText) == editMessageRequest.messageText)
        {
            return UnprocessableEntity("Message text is the same as the current message");
        }

        //encrypts the message before storing in database
        foundMessage.messageText = encryptionService.Encrypt(editMessageRequest.messageText);
        foundMessage.edited = true;

        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteMessage(long id)
    {
        long? userId = GetUserId();

        if(userId == null)
        {
            return Unauthorized();
        }

        Message? foundMessage = await db.Messages.FirstOrDefaultAsync(message => message.id == id);

        if(foundMessage == null)
        {
            return NotFound();
        }

        Server? foundServer = await db.Servers.AsNoTracking().FirstOrDefaultAsync(server => db.Channels.Any(channel => channel.id == foundMessage.channelID && channel.serverID == server.id));

        if(foundServer == null)
        {
            return NotFound();
        }

        //checks if deleter is not sender or server owner
        if(foundMessage.sender != userId && foundServer.ownerID != userId)
        {
            return Forbid();
        }

        db.Messages.Remove(foundMessage);

        await db.SaveChangesAsync();

        return NoContent();
    }
}