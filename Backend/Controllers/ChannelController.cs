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
public class ChannelController : ControllerBase
{
    private readonly MessagingAppContext db;
    private readonly JwtService jwtService;
    private readonly AuthService authService;
    private readonly JwtSettings jwtSettings;

    public ChannelController(MessagingAppContext db, JwtService jwtService, AuthService authService, IOptions<JwtSettings> jwtSettings)
    {
        this.db = db;
        this.jwtService = jwtService;
        this.authService = authService;
        this.jwtSettings = jwtSettings.Value;
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateChannel(long id, UpdateChannelRequest updateChannelRequest)
    {
        if(string.IsNullOrWhiteSpace(updateChannelRequest.channelName))
        {
            return BadRequest("Invalid channel name");
        }

        string ? stringId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if(stringId == null)
        {
            return Unauthorized();
        }

        long userId = long.Parse(stringId);

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
            return Unauthorized();
        }

        foundChannel.channelName = updateChannelRequest.channelName.Trim();

        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteChannel(long id)
    {
        string ? stringId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if(stringId == null)
        {
            return Unauthorized();
        }

        long userId = long.Parse(stringId);

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
            return Unauthorized();
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
}