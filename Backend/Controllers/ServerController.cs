using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Messaging_App.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Messaging_App.Hubs;
using Messaging_App.Services;

namespace Messaging_App.Controllers;

[Authorize]
[ApiController]
[Route("servers")]
public class ServerController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;
    private readonly IHubContext<ChatHub> hubContext;
    private readonly HubGroupService hubGroupService;
    private readonly PresenceService presenceService;

    public ServerController(MessagingAppContext db, IHubContext<ChatHub> hubContext, HubGroupService hubGroupService, PresenceService presenceService)
    {
        this.db = db;
        this.presenceService = presenceService;
        this.hubContext = hubContext;
        this.hubGroupService = hubGroupService;
    }

    //Server API

    [HttpPost]
    public async Task<ActionResult<CreateServerResult>> CreateServer(CreateServerRequest createServerRequest)
    {
        if(string.IsNullOrWhiteSpace(createServerRequest.serverName))
        {
            return BadRequest("All fields must be filled");
        }

        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null)
            return Unauthorized();

        long userId = nullableUserId.Value;

        Server newServer = new Server();
        newServer.serverName = createServerRequest.serverName;
        newServer.ownerID = userId;

        //serverID is filled in by EF when the server is inserted
        ServerMember ownerMember = new ServerMember();
        ownerMember.userID = userId;
        newServer.members.Add(ownerMember);

        db.Servers.Add(newServer);

        await db.SaveChangesAsync();

        await hubGroupService.AddUserToGroup(userId, $"server_{newServer.id}");

        CreateServerResult result = new CreateServerResult();

        result.serverID = newServer.id;
        result.serverName = newServer.serverName;

        return Ok(result);
    }

    [HttpGet]
    public async Task<ActionResult<List<ServerResult>>> GetServers()
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        //gets all the servers the user is in
        List<ServerResult> servers = await db.ServerMembers.AsNoTracking().Where(member => member.userID == userId).Join(db.Servers, member => member.serverID, server => server.id, (member, server) => new { server }).Join(db.Users, s => s.server.ownerID, user => user.id, (s, user) => new ServerResult{serverID = s.server.id, ownerUsername = user.username, serverName = s.server.serverName, iconUrl = s.server.iconUrl, hasUnread = db.Channels.Any(channel => channel.serverID == s.server.id && db.Messages.Any(message => message.channelID == channel.id && message.id > (db.ChannelReadStates.Where(readState => readState.userID == userId && readState.channelID == channel.id).Select(readState => (long?)readState.lastReadMessageID).FirstOrDefault() ?? 0)))}).ToListAsync();

        return Ok(servers);
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ServerResult>> GetServer(long id)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        Server? server = await db.Servers.AsNoTracking().FirstOrDefaultAsync(servers => servers.id == id);

        if(server == null)
        {
            return NotFound();
        }

        //checks if the user is a member of the server, non-members use the invite preview instead
        ServerMember? isMember = await db.ServerMembers.AsNoTracking().FirstOrDefaultAsync(members => members.serverID == id && members.userID == userId);

        if(isMember == null)
        {
            return Forbid();
        }

        User? owner = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.id == server.ownerID);

        if(owner == null)
        {
            return NotFound();
        }

        ServerResult result = new ServerResult();

        result.serverID = server.id;
        result.serverName = server.serverName;
        result.ownerUsername = owner.username;
        result.iconUrl = server.iconUrl;

        return Ok(result);
    }

    [HttpGet("{id:long}/members")]
    public async Task<ActionResult<List<UserResult>>> GetServerMembers(long id)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        //checks if the user is a member of the server
        ServerMember? isMember = await db.ServerMembers.AsNoTracking().FirstOrDefaultAsync(members => members.serverID == id && members.userID == userId);

        if(isMember == null)
        {
            return Forbid();
        }

        //gets all members of a server
        List<UserResult> members = await db.ServerMembers.AsNoTracking().Where(member => member.serverID == id).Join(db.Users, member => member.userID, user => user.id, (member, user) => new UserResult{displayName = user.displayName, username = user.username, profileImageUrl = user.profileImageUrl, activityStatus = presenceService.GetDisplayedStatus(user.id, user.activityStatus), accountCreationTime = user.accountCreationTime}).ToListAsync();

        return Ok(members);
    }

    [HttpPatch("{id:long}")]
    public async Task<IActionResult> UpdateServer(long id, UpdateServerRequest updateServerRequest)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        Server? foundServer = await db.Servers.FirstOrDefaultAsync(server => server.id == id);

        if(foundServer == null)
        {
            return NotFound();
        }

        if(userId != foundServer.ownerID)
        {
            return Forbid();
        }

        //checks if the user is changing the name
        if(updateServerRequest.serverName != null)
        {
            string trimmed = updateServerRequest.serverName.Trim();

            if(!string.IsNullOrWhiteSpace(trimmed))
            {
                foundServer.serverName = trimmed;
            }
        }

        //checks if the user is changing the ico
        if(updateServerRequest.iconUrl != null)
        {
            foundServer.iconUrl = updateServerRequest.iconUrl;
        }

        await db.SaveChangesAsync();

        User? owner = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.id == foundServer.ownerID);

        if(owner == null)
        {
            return NotFound();
        }

        ServerResult result = new ServerResult();
        result.serverID = foundServer.id;
        result.serverName = foundServer.serverName;
        result.ownerUsername = owner.username;
        result.iconUrl = foundServer.iconUrl;

        await hubContext.Clients.Group($"server_{foundServer.id}").SendAsync("ServerUpdated", foundServer.serverName, foundServer.iconUrl);

        return Ok(result);
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> DeleteServer(long id)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        Server? foundServer = await db.Servers.FirstOrDefaultAsync(server => server.id == id);

        if(foundServer == null)
        {
            return NotFound();
        }

        if(foundServer.ownerID != userId)
        {
            return Forbid();
        }

        List<long> memberIds = await db.ServerMembers.AsNoTracking().Where(member => member.serverID == id).Select(member => member.userID).ToListAsync();

        await hubContext.Clients.Group($"server_{foundServer.id}").SendAsync("ServerDeleted", foundServer.id);

        foreach (long memberId in memberIds)
            await hubGroupService.RemoveUserFromGroup(memberId, $"server_{foundServer.id}");

        db.Servers.Remove(foundServer);
        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id:long}/members/me")]
    public async Task<IActionResult> LeaveServer(long id)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        ServerMember? foundMember = await db.ServerMembers.FirstOrDefaultAsync(member => member.serverID == id && member.userID == userId);
        Server? foundServer = await db.Servers.AsNoTracking().FirstOrDefaultAsync(server => server.id == id);

        if(foundMember == null || foundServer == null)
        {
            return NotFound();
        }

        db.ServerMembers.Remove(foundMember);
        
        string? newOwnerUsername = null;

        //checks if the user was the server owner
        if(foundServer.ownerID == userId)
        {
            foundServer = await db.Servers.FirstOrDefaultAsync(server => server.id == id);

            if(foundServer == null)
            {
                return NotFound();
            }

            ServerMember? newOwner = await db.ServerMembers.FirstOrDefaultAsync(member => member.serverID == id && member.userID != userId);

            //deletes the server if no other members in the server
            if(newOwner == null)
            {
                await hubGroupService.RemoveUserFromGroup(userId, $"server_{id}");
                db.Servers.Remove(foundServer);
                await db.SaveChangesAsync();
                return NoContent();
            }
            else
            {
                foundServer.ownerID = newOwner.userID;

                newOwnerUsername = await db.Users.AsNoTracking().Where(user => user.id == newOwner.userID).Select(user=> user.username).FirstOrDefaultAsync();
            }
        }

        await db.SaveChangesAsync();

        if(newOwnerUsername != null)
            await hubContext.Clients.Group($"server_{id}").SendAsync("OwnerChanged", newOwnerUsername);

        await hubContext.Clients.Group($"server_{id}").SendAsync("MemberLeft", GetUsername());
        await hubGroupService.RemoveUserFromGroup(userId, $"server_{id}");

        return NoContent();
    }

    [HttpDelete("{id:long}/members/{username}")]
    public async Task<IActionResult> KickUser(long id, string username)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;
        
        Server? foundServer = await db.Servers.AsNoTracking().FirstOrDefaultAsync(server => server.id == id);

        if(foundServer == null)
        {
            return NotFound();
        }

        if(foundServer.ownerID != userId)
        {
            return Forbid();
        }

        User? foundUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.username == username);

        if(foundUser == null)
        {
            return NotFound();
        }

        if(foundUser.id == userId)
        {
            return Forbid();
        }

        ServerMember? foundMember = await db.ServerMembers.FirstOrDefaultAsync(member => member.serverID == id && member.userID == foundUser.id);

        if(foundMember == null)
        {
            return NotFound();
        }

        db.ServerMembers.Remove(foundMember);

        await db.SaveChangesAsync();

        await hubContext.Clients.Group($"server_{id}").SendAsync("MemberKicked", foundUser.username);
        await hubGroupService.RemoveUserFromGroup(foundUser.id, $"server_{id}");

        return NoContent();
    }

    //Channel API

    [HttpPost("{id:long}/channels")]
    public async Task<ActionResult<CreateChannelResult>> CreateChannel(long id, CreateChannelRequest createChannelRequest)
    {
        if(string.IsNullOrWhiteSpace(createChannelRequest.channelName))
        {
            return BadRequest("All fields must be filled");
        }

        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        Server? foundServer = await db.Servers.FirstOrDefaultAsync(server => server.id == id);

        if(foundServer == null)
        {
            return NotFound();
        }

        if(foundServer.ownerID != userId)
        {
            return Forbid();
        }

        //locking the server makes two channels created at once take turns, so they can't get the same order
        await using IDbContextTransaction transaction = await db.Database.BeginTransactionAsync();
        await db.LockServerAsync(id);

        int? highestOrder = await db.Channels.Where(channel => channel.serverID == id).MaxAsync(channel => (int?)channel.channelOrder);

        Channel newChannel = new Channel();

        newChannel.channelName = createChannelRequest.channelName;
        newChannel.serverID = id;
        newChannel.channelOrder = highestOrder == null ? 0 : highestOrder.Value + 1;

        db.Channels.Add(newChannel);

        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        CreateChannelResult result = new CreateChannelResult();
        result.channelID = newChannel.id;
        result.channelName = newChannel.channelName;
        result.channelOrder = newChannel.channelOrder;

        await hubContext.Clients.Group($"server_{id}").SendAsync("ChannelCreated", result);

        return Ok(result);
    }

    [HttpGet("{id:long}/channels")]
    public async Task<ActionResult<List<ChannelResult>>> GetChannels(long id)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        bool? isMember = await db.Servers.Where(server => server.id == id).Select(server => (bool?)db.ServerMembers.Any(member => member.serverID == server.id && member.userID == userId)).FirstOrDefaultAsync();

        if(isMember == null)
        {
            return NotFound();
        }

        if(isMember == false)
        {
            return Forbid();
        }

        //gets all of the channels in the server, a channel is unread if it has a message past the user's read marker
        List<ChannelResult> results = await db.Channels.AsNoTracking().Where(channel => channel.serverID == id).OrderBy(channel => channel.channelOrder).Select(channel => new ChannelResult{channelID = channel.id, channelName = channel.channelName, channelOrder = channel.channelOrder, hasUnread = db.Messages.Any(message => message.channelID == channel.id && message.id > (db.ChannelReadStates.Where(readState => readState.userID == userId && readState.channelID == channel.id).Select(readState => (long?)readState.lastReadMessageID).FirstOrDefault() ?? 0))}).ToListAsync();

        return Ok(results);
    }

    [HttpPut("{id:long}/channels/order")]
    public async Task<IActionResult> ReorderChannels(long id, ReorderChannelRequest reorderChannelRequest)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        Server? foundServer = await db.Servers.FirstOrDefaultAsync(server => server.id == id);

        if(foundServer == null)
        {
            return NotFound();
        }

        if(foundServer.ownerID != userId)
        {
            return Forbid();
        }

        //a repeated id would leave another channel on its old position and clash with the unique order
        if (reorderChannelRequest.channelIDs.Distinct().Count() != reorderChannelRequest.channelIDs.Count)
        {
            return BadRequest("Channel list contains duplicates");
        }

        await using IDbContextTransaction transaction = await db.Database.BeginTransactionAsync();
        await db.LockServerAsync(id);

        List<Channel> channels = await db.Channels.Where(c => c.serverID == id).ToListAsync();

        if (reorderChannelRequest.channelIDs.Count != channels.Count)
        {
            return BadRequest("Channel list does not match server channels");
        }

        for (int i = 0; i < reorderChannelRequest.channelIDs.Count; i++)
        {
            Channel? channel = channels.FirstOrDefault(c => c.id == reorderChannelRequest.channelIDs[i]);

            if (channel == null)
            {
                return BadRequest("Invalid channel ID");
            }

            channel.channelOrder = i;
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        await hubContext.Clients.Group($"server_{id}").SendAsync("ChannelsReordered", reorderChannelRequest.channelIDs);

        return NoContent();
    }

    //Invite API
    [HttpPost("{id:long}/invites")]
    public async Task<ActionResult<CreateInviteResult>> CreateInvite(long id, CreateInviteRequest createInviteRequest)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        ServerMember? foundMember = await db.ServerMembers.AsNoTracking().FirstOrDefaultAsync(member => member.serverID == id && member.userID == userId);

        if(foundMember == null)
        {
            return Forbid();
        }

        ServerInvite newInvite = new ServerInvite();
        newInvite.createdBy = userId;
        newInvite.serverID = id;
        newInvite.expiresDate = createInviteRequest.expiresDate;
        newInvite.maxUses = createInviteRequest.maxUses;

        db.ServerInvites.Add(newInvite);

        await db.SaveChangesAsync();

        CreateInviteResult result = new CreateInviteResult();
        result.inviteCode = newInvite.inviteCode;
        result.expiresDate = newInvite.expiresDate;
        result.maxUses = newInvite.maxUses;

        return Ok(result);
    }

    [HttpGet("{id:long}/invites")]
    public async Task<ActionResult<List<InviteResult>>> GetInvites(long id)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;
        
        Server? foundServer = await db.Servers.AsNoTracking().FirstOrDefaultAsync(server => server.id == id);

        if(foundServer == null)
        {
            return NotFound();
        }

        if(foundServer.ownerID != userId)
        {
            return Forbid();
        }

        List<InviteResult> results = await db.ServerInvites.AsNoTracking().Where(invite => invite.serverID == id).Join(db.Users, invite => invite.createdBy, user => user.id, (invite, user) => new InviteResult{inviteCode = invite.inviteCode, createdByUsername = user.username, createdDate = invite.createdDate, expiresDate = invite.expiresDate, maxUses = invite.maxUses, uses = invite.uses}).ToListAsync();

        return Ok(results);
    }

    [HttpDelete("{id:long}/invites/{code:guid}")]
    public async Task<IActionResult> DeleteInvite(long id, Guid code)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;
        
        Server? foundServer = await db.Servers.AsNoTracking().FirstOrDefaultAsync(server => server.id == id);

        if(foundServer == null)
        {
            return NotFound();
        }

        if(foundServer.ownerID != userId)
        {
            return Forbid();
        }

        ServerInvite? foundInvite = await db.ServerInvites.FirstOrDefaultAsync(invite => invite.inviteCode == code  && invite.serverID == id);

        if(foundInvite == null)
        {
            return NotFound();
        }

        db.ServerInvites.Remove(foundInvite);

        await db.SaveChangesAsync();

        return NoContent();
    }
}