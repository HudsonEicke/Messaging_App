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
public class ConversationMessageController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly EncryptionService encryptionService;

    public ConversationMessageController(MessagingAppContext db, EncryptionService encryptionService)
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

        ConversationMessage? foundMessage = await db.ConversationMessages.FirstOrDefaultAsync(message => message.id == id);

        if(foundMessage == null)
        {
            return NotFound();
        }

        if(foundMessage.sender != userId)
        {
            return Forbid();
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
        long? userId = GetUserId();

        if(userId == null)
        {
            return Unauthorized();
        }

        ConversationMessage? foundMessage = await db.ConversationMessages.FirstOrDefaultAsync(message => message.id == id);

        if(foundMessage == null)
        {
            return NotFound();
        }

        Conversation? foundConversation = await db.Conversations.AsNoTracking().FirstOrDefaultAsync(conversation => conversation.id == foundMessage.conversationID);

        if(foundConversation == null)
        {
            return NotFound();
        }

        if(foundMessage.sender != userId && foundConversation.ownerID != userId)
        {
            return Forbid();
        }
        
        db.ConversationMessages.Remove(foundMessage);

        await db.SaveChangesAsync();

        return NoContent();
    }
}