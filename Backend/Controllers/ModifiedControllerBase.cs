using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace Messaging_App.Controllers;

public class ModifiedControllerBase : ControllerBase
{
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
}