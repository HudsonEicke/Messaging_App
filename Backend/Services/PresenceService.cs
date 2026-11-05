using Messaging_App.Hubs;

namespace Messaging_App.Services;

public class PresenceService
{
    private readonly ConnectionTracker connectionTracker;

    public PresenceService(ConnectionTracker connectionTracker)
    {
        this.connectionTracker = connectionTracker;
    }

    public ActivityStatus GetDisplayedStatus(long userId, ActivityStatus preferredStatus)
    {
        return connectionTracker.IsConnected(userId) ? preferredStatus : ActivityStatus.offline;
    }
}
