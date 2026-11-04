using System.Security.Claims;
using Messaging_App.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Messaging_App.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly MessagingAppContext db;
    private readonly ConnectionTracker connectionTracker;

    public ChatHub(MessagingAppContext db, ConnectionTracker connectionTracker)
    {
        this.db = db;
        this.connectionTracker = connectionTracker;
    }

    public override async Task OnConnectedAsync()
    {
        long userId = long.Parse(Context.User!.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        //registered before loading groups so a server or conversation joined during the load still reaches this connection
        bool isFirstConnection = connectionTracker.AddConnection(userId, Context.ConnectionId, new List<string>());

        List<string> groups = new List<string>();

        List<long> serverIds = await db.ServerMembers.AsNoTracking().Where(member => member.userID == userId).Select(member => member.serverID).ToListAsync();

        foreach(long serverId in serverIds)
        {
            string groupName = $"server_{serverId}";
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            groups.Add(groupName);
        }

        List<long> conversationIds = await db.ConversationMembers.AsNoTracking().Where(member => member.userID == userId).Select(member => member.conversationID).ToListAsync();

        foreach(long conversationId in conversationIds)
        {
            string groupName = $"conversation_{conversationId}";
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            groups.Add(groupName);
        }

        connectionTracker.AddGroupsToConnection(Context.ConnectionId, groups);

        if (isFirstConnection)
        {
            User? user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.id == userId);

            if (user != null && user.activityStatus != ActivityStatus.offline)
            {
                await Clients.Groups(groups).SendAsync("UserStatusChanged", user.username, user.activityStatus);
            }
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        long userId = long.Parse(Context.User!.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        bool isLastConnection = connectionTracker.RemoveConnection(userId, Context.ConnectionId, out List<string> groups);

        string? username = Context.User!.FindFirst(ClaimTypes.Name)?.Value;

        if (isLastConnection && username != null)
        {
            await Clients.Groups(groups).SendAsync("UserStatusChanged", username, ActivityStatus.offline);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendTypingIndicator(string groupName, bool isTyping)
    {
        if(!connectionTracker.IsInGroup(Context.ConnectionId, groupName))
            return;
        
        string? username = Context.User!.FindFirst(ClaimTypes.Name)?.Value;

        if(username == null)
            return;

        await Clients.OthersInGroup(groupName).SendAsync("UserTyping", username, isTyping);
    }
}