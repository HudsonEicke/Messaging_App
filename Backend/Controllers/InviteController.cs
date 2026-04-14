using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;
using Messaging_App.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Messaging_App.Hubs;

namespace Messaging_App.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class InviteController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly IHubContext<ChatHub> hubContext;

    public InviteController(MessagingAppContext db, IHubContext<ChatHub> hubContext)
    {
        this.db = db;
        this.hubContext = hubContext;
    }

    [HttpPost("{code}/join")]
    public async Task<ActionResult<ServerResult>> JoinServer(Guid code)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        ServerInvite? foundInvite = await db.ServerInvites.FirstOrDefaultAsync(invite => invite.inviteCode == code);

        if(foundInvite == null)
        {
            return NotFound();
        }

        if(foundInvite.maxUses != null && foundInvite.maxUses == foundInvite.uses)
        {
            return BadRequest("Invite out of uses");
        }

        if(foundInvite.expiresDate != null && foundInvite.expiresDate < DateTimeOffset.Now)
        {
            return BadRequest("Invite has expired");
        }

        ServerMember? foundMember = await db.ServerMembers.AsNoTracking().FirstOrDefaultAsync(member => member.serverID == foundInvite.serverID && member.userID == userId);

        if(foundMember != null)
        {
            return BadRequest("Already a member of this server");
        }

        ServerMember newMember = new ServerMember();
        newMember.serverID = foundInvite.serverID;
        newMember.userID = userId;

        db.ServerMembers.Add(newMember);
        foundInvite.uses++;

        await db.SaveChangesAsync();

        Server? foundServer = await db.Servers.AsNoTracking().FirstOrDefaultAsync(server => server.id == foundInvite.serverID);

        if(foundServer == null)
        {
            return NotFound();
        }

        User? owner = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.id == foundServer.ownerID);

        if(owner == null)
        {
            return NotFound();
        }

        await ChatHub.AddUserToGroup(hubContext, userId, $"server_{foundInvite.serverID}");
        string? username = GetUsername();
        await hubContext.Clients.Group($"server_{foundInvite.serverID}").SendAsync("MemberJoined", username);

        ServerResult result = new ServerResult();
        result.serverID = foundServer.id;
        result.serverName = foundServer.serverName;
        result.ownerUsername = owner.username;
        result.iconUrl = foundServer.iconUrl;

        return Ok(result);
    }
}