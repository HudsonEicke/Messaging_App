using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;
using Messaging_App.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace Messaging_App.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class ServerController : ModifiedControllerBase
{
    private readonly MessagingAppContext db;

    public ServerController(MessagingAppContext db)
    {
        this.db = db;
    }

    //Server API

    [HttpPost("createserver")]
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

        db.Servers.Add(newServer);

        await db.SaveChangesAsync();

        ServerMember ownerMember = new ServerMember();
        ownerMember.serverID = newServer.id;
        ownerMember.userID = userId;
        db.ServerMembers.Add(ownerMember);

        await db.SaveChangesAsync();

        CreateServerResult result = new CreateServerResult();

        result.serverID = newServer.id;
        result.serverName = newServer.serverName;

        return Ok(result);
    }

    [HttpGet("servers")]
    public async Task<ActionResult<List<ServerResult>>> GetServers()
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        List<ServerResult> servers = await db.ServerMembers.AsNoTracking().Where(member => member.userID == userId).Join(db.Servers, member => member.serverID, server => server.id, (member, server) => new ServerResult{serverID = server.id, ownerID = server.ownerID, serverName = server.serverName, iconUrl = server.iconUrl}).ToListAsync();

        return Ok(servers);
    }

    [HttpGet("{id}")]
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

        ServerResult result = new ServerResult();

        result.serverID = server.id;
        result.serverName = server.serverName;
        result.ownerID = server.ownerID;
        result.iconUrl = server.iconUrl;

        return Ok(result);
    }

    [HttpGet("{id}/members")]
    public async Task<ActionResult<List<UserResult>>> GetServerMembers(long id)
    {
        long? nullableUserId = GetUserId();
        
        if(nullableUserId == null) 
            return Unauthorized();

        long userId = nullableUserId.Value;

        ServerMember? isMember = await db.ServerMembers.AsNoTracking().FirstOrDefaultAsync(members => members.serverID == id && members.userID == userId);

        if(isMember == null)
        {
            return Forbid();
        }

        List<UserResult> members = await db.ServerMembers.AsNoTracking().Where(member => member.serverID == id).Join(db.Users, member => member.userID, user => user.id, (member, user) => new UserResult{displayName = user.displayName, username = user.username, profileImageUrl = user.profileImageUrl, activityStatus = user.activityStatus, accountCreationTime = user.accountCreationTime}).ToListAsync();

        return Ok(members);
    }

    [HttpPut("{id}")]
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

        if(updateServerRequest.serverName != null)
        {
            string trimmed = updateServerRequest.serverName.Trim();

            if(!string.IsNullOrWhiteSpace(trimmed))
            {
                foundServer.serverName = trimmed;
            }
        }

        if(updateServerRequest.serverImageUrl != null)
        {
            foundServer.iconUrl = updateServerRequest.serverImageUrl;
        }

        await db.SaveChangesAsync();

        ServerResult result = new ServerResult();
        result.serverID = foundServer.id;
        result.serverName = foundServer.serverName;
        result.ownerID = foundServer.ownerID;
        result.iconUrl = foundServer.iconUrl;

        return Ok(result);
    }

    [HttpDelete("{id}")]
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

        db.Servers.Remove(foundServer);
        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{id}/leave")]
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

        if(foundServer.ownerID == userId)
        {
            foundServer = await db.Servers.FirstOrDefaultAsync(server => server.id == id);

            if(foundServer == null)
            {
                return NotFound();
            }

            ServerMember? newOwner = await db.ServerMembers.FirstOrDefaultAsync(member => member.serverID == id && member.userID != userId);

            if(newOwner == null)
            {
                db.Servers.Remove(foundServer);
            }
            else
            {
                foundServer.ownerID = newOwner.userID;
            }
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}/members/{username}")]
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

        return NoContent();
    }

    //Channel API

    [HttpPost("{id}/createchannel")]
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

        Channel newChannel = new Channel();

        newChannel.channelName = createChannelRequest.channelName;
        newChannel.serverID = id;
        newChannel.channelOrder = await db.Channels.CountAsync(channels => channels.serverID == id);

        db.Channels.Add(newChannel);

        await db.SaveChangesAsync();

        CreateChannelResult result = new CreateChannelResult();
        result.channelID = newChannel.id;
        result.channelName = newChannel.channelName;
        result.channelOrder = newChannel.channelOrder;

        return Ok(result);
    }

    [HttpGet("{id}/channels")]
    public async Task<ActionResult<List<ChannelResult>>> GetChannels(long id)
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

        ServerMember? isMember = await db.ServerMembers.AsNoTracking().FirstOrDefaultAsync(member => member.serverID == id && member.userID == userId);

        if(isMember == null)
        {
            return Forbid();
        }

        List<ChannelResult> results = await db.Channels.AsNoTracking().Where(channel => channel.serverID == id).OrderBy(channel => channel.channelOrder).Select(channel => new ChannelResult{channelID = channel.id, channelName = channel.channelName, channelOrder = channel.channelOrder}).ToListAsync();

        return Ok(results);
    }

    //reorder channels
    //implement here
    [HttpPut("{id}/channels/reorder")]
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

        return NoContent();
    }

    //Invite API
}