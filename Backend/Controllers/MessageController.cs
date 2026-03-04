using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;
using Messaging_App.Data;
using Microsoft.AspNetCore.Identity;
using Messaging_App.Services;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using Messaging_App.Configuration;
using Microsoft.AspNetCore.Authorization;

namespace Messaging_App.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class MessageController : ControllerBase
{
    private readonly MessagingAppContext db;
    private readonly JwtService jwtService;
    private readonly AuthService authService;
    private readonly EncryptionService encryptionService;
    private readonly JwtSettings jwtSettings;
    private const int MESSAGEGRABAMOUNT = 50;

    public MessageController(MessagingAppContext db, JwtService jwtService, AuthService authService, IOptions<JwtSettings> jwtSettings, EncryptionService encryptionService)
    {
        this.db = db;
        this.jwtService = jwtService;
        this.authService = authService;
        this.jwtSettings = jwtSettings.Value;
        this.encryptionService = encryptionService;
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> EditMessage(long id, EditMessageRequest editMessageRequest)
    {
        if(string.IsNullOrWhiteSpace(editMessageRequest.messageText))
        {
            return BadRequest("Invalid message text");
        }

        string ? stringId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if(stringId == null)
        {
            return Unauthorized();
        }

        long userId = long.Parse(stringId);

        Message? foundMessage = await db.Messages.FirstOrDefaultAsync(message => message.id == id);

        if(foundMessage == null)
        {
            return NotFound();
        }

        if(foundMessage.sender != userId)
        {
            return Unauthorized();
        }

        if(encryptionService.Decrypt(foundMessage.messageText) == editMessageRequest.messageText)
        {
            return UnprocessableEntity("Message text is the same as the current message");
        }

        foundMessage.messageText = encryptionService.Encrypt(editMessageRequest.messageText);
        foundMessage.edited = true;

        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteMessage(long id)
    {
        string ? stringId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if(stringId == null)
        {
            return Unauthorized();
        }

        long userId = long.Parse(stringId);

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

        if(foundMessage.sender != userId && foundServer.ownerID != userId)
        {
            return Unauthorized();
        }

        db.Messages.Remove(foundMessage);

        await db.SaveChangesAsync();

        return NoContent();
    }
}