using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace Messaging_App.Controllers;

//modified controller base for repeated blocks of code
public class ModifiedControllerBase : ControllerBase
{
    private const int REPLYPREVIEWLENGTH = 100;

    protected long? GetUserId()
    {
        string? stringId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (stringId == null)
            return null;
            
        return long.Parse(stringId);
    }

    protected string? GetUsername()
    {
        string? username = User.FindFirst(ClaimTypes.Name)?.Value;
        return username;
    }

    //reply previews only need the start of the original message
    protected static string ShortenReplyPreview(string messageText)
    {
        if (messageText.Length <= REPLYPREVIEWLENGTH)
            return messageText;

        int cutIndex = REPLYPREVIEWLENGTH;

        //don't split an emoji or other surrogate pair in half
        if (char.IsHighSurrogate(messageText[cutIndex - 1]))
            cutIndex--;

        return messageText.Substring(0, cutIndex).TrimEnd() + "…";
    }
}
