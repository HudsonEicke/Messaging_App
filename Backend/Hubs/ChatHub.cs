using System.Security.Claims;
using Messaging_App.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;

namespace Messaging_App.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly MessagingAppContext db;
    private static readonly ConcurrentDictionary<string, HashSet<string>> _connectionGroups = new();
    private static readonly ConcurrentDictionary<long, HashSet<string>> _userConnections = new();


    public ChatHub(MessagingAppContext db)
    {
        this.db = db;
    }

    public override async Task OnConnectedAsync()
    {
        long userId = long.Parse(Context.User!.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        _userConnections.AddOrUpdate(userId, new HashSet<string> { Context.ConnectionId }, (key, existing) => { existing.Add(Context.ConnectionId); return existing; });

        HashSet<string> groups = new HashSet<string>();

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

        _connectionGroups[Context.ConnectionId] = groups;

        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        long userId = long.Parse(Context.User!.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        _connectionGroups.TryRemove(Context.ConnectionId, out _);

        if (_userConnections.TryGetValue(userId, out HashSet<string>? connections))
        {
            connections.Remove(Context.ConnectionId);
            if (connections.Count == 0)
                _userConnections.TryRemove(userId, out _);
        }

        return base.OnDisconnectedAsync(exception);
    }

    public async Task SendTypingIndicator(string groupName, bool isTyping)
    {
        HashSet<string>? groups;
        if(!_connectionGroups.TryGetValue(Context.ConnectionId, out groups) || !groups.Contains(groupName))
            return;
        
        string? username = Context.User!.FindFirst(ClaimTypes.Name)?.Value;

        if(username == null)
            return;

        await Clients.OthersInGroup(groupName).SendAsync("UserTyping", username, isTyping);
    }

    public static async Task RemoveUserFromGroup(IHubContext<ChatHub> hubContext, long userId, string groupName)
    {
        if (!_userConnections.TryGetValue(userId, out HashSet<string>? connections))
            return;

        foreach (string connectionId in connections)
            await hubContext.Groups.RemoveFromGroupAsync(connectionId, groupName);
    }

    public static async Task AddUserToGroup(IHubContext<ChatHub> hubContext, long userId, string groupName)
    {
        if (!_userConnections.TryGetValue(userId, out HashSet<string>? connections))
            return;

        foreach (string connectionId in connections)
            await hubContext.Groups.AddToGroupAsync(connectionId, groupName);
    }

}