using Messaging_App.Hubs;
using Messaging_App.Services;

namespace Backend.Tests.Unit;

public class PresenceServiceTests
{
    private readonly ConnectionTracker connectionTracker = new ConnectionTracker();
    private readonly PresenceService presenceService;

    public PresenceServiceTests()
    {
        presenceService = new PresenceService(connectionTracker);
    }

    [Theory]
    [InlineData(ActivityStatus.online)]
    [InlineData(ActivityStatus.away)]
    [InlineData(ActivityStatus.dnd)]
    [InlineData(ActivityStatus.offline)]
    public void GetDisplayedStatus_WhenConnected_ReturnsChosenStatus(ActivityStatus preferredStatus)
    {
        //arrange
        connectionTracker.AddConnection(1, "conn1", new List<string>());

        //act
        ActivityStatus displayed = presenceService.GetDisplayedStatus(1, preferredStatus);

        //assert
        Assert.Equal(preferredStatus, displayed);
    }

    [Theory]
    [InlineData(ActivityStatus.online)]
    [InlineData(ActivityStatus.away)]
    [InlineData(ActivityStatus.dnd)]
    public void GetDisplayedStatus_WhenNotConnected_ReturnsOffline(ActivityStatus preferredStatus)
    {
        //act
        ActivityStatus displayed = presenceService.GetDisplayedStatus(1, preferredStatus);

        //assert
        Assert.Equal(ActivityStatus.offline, displayed);
    }

    [Fact]
    public void GetDisplayedStatus_AfterReconnecting_KeepsDnd()
    {
        //arrange: connect, disconnect, then connect again
        connectionTracker.AddConnection(1, "conn1", new List<string>());
        connectionTracker.RemoveConnection(1, "conn1", out _);
        ActivityStatus whileDisconnected = presenceService.GetDisplayedStatus(1, ActivityStatus.dnd);
        connectionTracker.AddConnection(1, "conn2", new List<string>());

        //act
        ActivityStatus afterReconnect = presenceService.GetDisplayedStatus(1, ActivityStatus.dnd);

        //assert
        Assert.Equal(ActivityStatus.offline, whileDisconnected);
        Assert.Equal(ActivityStatus.dnd, afterReconnect);
    }
}
