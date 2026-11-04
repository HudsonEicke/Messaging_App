using Microsoft.AspNetCore.SignalR;

namespace Messaging_App.Hubs;

//adds or removes all of a user's live connections from a SignalR group, used by controllers when membership changes
public class HubGroupService
{
    private readonly IHubContext<ChatHub> hubContext;
    private readonly ConnectionTracker connectionTracker;

    public HubGroupService(IHubContext<ChatHub> hubContext, ConnectionTracker connectionTracker)
    {
        this.hubContext = hubContext;
        this.connectionTracker = connectionTracker;
    }

    public async Task AddUserToGroup(long userId, string groupName)
    {
        //the tracker is updated first, SignalR is called outside the lock since awaiting inside a lock isn't allowed
        List<string> connectionIds = connectionTracker.AddGroup(userId, groupName);

        foreach(string connectionId in connectionIds)
        {
            await hubContext.Groups.AddToGroupAsync(connectionId, groupName);
        }
    }

    public async Task RemoveUserFromGroup(long userId, string groupName)
    {
        List<string> connectionIds = connectionTracker.RemoveGroup(userId, groupName);

        foreach(string connectionId in connectionIds)
        {
            await hubContext.Groups.RemoveFromGroupAsync(connectionId, groupName);
        }
    }
}
