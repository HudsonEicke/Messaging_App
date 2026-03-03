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
public class ServerController : ControllerBase
{
    private readonly MessagingAppContext db;
    private readonly JwtService jwtService;
    private readonly AuthService authService;
    private readonly JwtSettings jwtSettings;

    public ServerController(MessagingAppContext db, JwtService jwtService, AuthService authService, IOptions<JwtSettings> jwtSettings)
    {
        this.db = db;
        this.jwtService = jwtService;
        this.authService = authService;
        this.jwtSettings = jwtSettings.Value;
    }

    [HttpPost("createserver")]
    public async Task<ActionResult<CreateServerResult>> CreateServer(CreateServerRequest createServerRequest)
    {
        if(string.IsNullOrWhiteSpace(createServerRequest.serverName))
        {
            return BadRequest("All fields must be filled");
        }

        string ? stringId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if(stringId == null)
        {
            return Unauthorized();
        }

        long userId = long.Parse(stringId);

        Server newServer = new Server();
        newServer.serverName = createServerRequest.serverName;
        newServer.ownerID = userId;

        db.Servers.Add(newServer);

        await db.SaveChangesAsync();

        CreateServerResult result = new CreateServerResult();

        result.serverID = newServer.id;
        result.serverName = newServer.serverName;

        return Ok(result);
    }

    [HttpGet("servers")]
    public async Task<ActionResult<List<ServerResult>>> GetServers()
    {
        string ? stringId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if(stringId == null)
        {
            return Unauthorized();
        }

        long userId = long.Parse(stringId);

        List<ServerResult> servers = await db.ServerMembers.Where(member => member.userID == userId).Join(db.Servers, member => member.serverID, server => server.id, (member, server) => new ServerResult{serverID = server.id, ownerID = server.ownerID, serverName = server.serverName, iconUrl = server.iconUrl}).ToListAsync();

        return Ok(servers);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ServerResult>> GetServer(long id)
    {
        string ? stringId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if(stringId == null)
        {
            return Unauthorized();
        }

        long userId = long.Parse(stringId);

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
}