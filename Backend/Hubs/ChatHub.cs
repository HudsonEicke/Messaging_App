using System.Security.Claims;
using Messaging_App.Data;
using Messaging_App.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Messaging_App.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly MessagingAppContext db;
    private readonly ConnectionTracker connectionTracker;
    private readonly FriendService friendService;

    public ChatHub(MessagingAppContext db, ConnectionTracker connectionTracker, FriendService friendService)
    {
        this.db = db;
        this.connectionTracker = connectionTracker;
        this.friendService = friendService;
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

                //friends who share no server or conversation aren't in those groups; someone in both gets it twice, which is harmless
                List<string> friendUserIds = await friendService.GetFriendUserIds(userId);
                await Clients.Users(friendUserIds).SendAsync("UserStatusChanged", user.username, user.activityStatus);
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

            List<string> friendUserIds = await friendService.GetFriendUserIds(userId);
            await Clients.Users(friendUserIds).SendAsync("UserStatusChanged", username, ActivityStatus.offline);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task StartChannelTyping(long channelId)
    {
        long? serverId = await db.Channels.AsNoTracking().Where(channel => channel.id == channelId).Select(channel => (long?)channel.serverID).FirstOrDefaultAsync();

        if(serverId == null)
            return;

        string groupName = $"server_{serverId}";

        //the tracker follows joins, leaves and kicks, so this is the membership check
        if(!connectionTracker.IsInGroup(Context.ConnectionId, groupName))
            return;

        User? typingUser = await GetCurrentUser();

        if(typingUser == null)
            return;

        await Clients.OthersInGroup(groupName).SendAsync("ChannelTyping", channelId, typingUser.username, typingUser.displayName);
    }

    public async Task StartConversationTyping(long conversationId)
    {
        string groupName = $"conversation_{conversationId}";

        if(!connectionTracker.IsInGroup(Context.ConnectionId, groupName))
            return;

        User? typingUser = await GetCurrentUser();

        if(typingUser == null)
            return;

        await Clients.OthersInGroup(groupName).SendAsync("ConversationTyping", conversationId, typingUser.username, typingUser.displayName);
    }

    //the display name goes in the typing events so clients can show it without having the typer in a loaded member list
    private async Task<User?> GetCurrentUser()
    {
        long userId = long.Parse(Context.User!.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        return await db.Users.AsNoTracking().FirstOrDefaultAsync(user => user.id == userId);
    }
}