using Messaging_App.Hubs;

namespace Backend.Tests.Unit;

public class ConnectionTrackerTests
{
    private readonly ConnectionTracker connectionTracker = new ConnectionTracker();

    //ADD CONNECTION
    [Fact]
    public void AddConnection_FirstConnection_ReturnsTrue()
    {
        //act
        bool isFirst = connectionTracker.AddConnection(1, "conn1", new List<string>());

        //assert
        Assert.True(isFirst);
    }

    [Fact]
    public void AddConnection_SecondConnection_ReturnsFalse()
    {
        //arrange
        connectionTracker.AddConnection(1, "conn1", new List<string>());

        //act
        bool isFirst = connectionTracker.AddConnection(1, "conn2", new List<string>());

        //assert
        Assert.False(isFirst);
        Assert.Equal(2, connectionTracker.GetConnections(1).Count);
    }

    //REMOVE CONNECTION
    [Fact]
    public void RemoveConnection_LastConnection_ReturnsTrueWithGroups()
    {
        //arrange
        connectionTracker.AddConnection(1, "conn1", new List<string> { "server_1", "conversation_2" });

        //act
        bool isLast = connectionTracker.RemoveConnection(1, "conn1", out List<string> groups);

        //assert
        Assert.True(isLast);
        Assert.Equal(new List<string> { "conversation_2", "server_1" }, groups.OrderBy(group => group).ToList());
        Assert.Empty(connectionTracker.GetConnections(1));
    }

    [Fact]
    public void RemoveConnection_OneOfSeveral_ReturnsFalse()
    {
        //arrange
        connectionTracker.AddConnection(1, "conn1", new List<string>());
        connectionTracker.AddConnection(1, "conn2", new List<string>());

        //act
        bool isLast = connectionTracker.RemoveConnection(1, "conn1", out _);

        //assert
        Assert.False(isLast);
        Assert.Equal(new List<string> { "conn2" }, connectionTracker.GetConnections(1));
    }

    [Fact]
    public void RemoveConnection_UnknownConnection_ReturnsFalse()
    {
        //act
        bool isLast = connectionTracker.RemoveConnection(1, "missing", out List<string> groups);

        //assert
        Assert.False(isLast);
        Assert.Empty(groups);
    }

    //GROUPS
    [Fact]
    public void AddGroup_AddsGroupToEveryConnectionOfUser()
    {
        //arrange
        connectionTracker.AddConnection(1, "conn1", new List<string>());
        connectionTracker.AddConnection(1, "conn2", new List<string>());
        connectionTracker.AddConnection(2, "other", new List<string>());

        //act
        List<string> connectionIds = connectionTracker.AddGroup(1, "server_5");

        //assert
        Assert.Equal(2, connectionIds.Count);
        Assert.True(connectionTracker.IsInGroup("conn1", "server_5"));
        Assert.True(connectionTracker.IsInGroup("conn2", "server_5"));
        Assert.False(connectionTracker.IsInGroup("other", "server_5"));
    }

    [Fact]
    public void RemoveGroup_RemovesGroupFromEveryConnectionOfUser()
    {
        //arrange
        connectionTracker.AddConnection(1, "conn1", new List<string> { "server_5" });
        connectionTracker.AddConnection(1, "conn2", new List<string> { "server_5" });

        //act
        connectionTracker.RemoveGroup(1, "server_5");

        //assert
        Assert.False(connectionTracker.IsInGroup("conn1", "server_5"));
        Assert.False(connectionTracker.IsInGroup("conn2", "server_5"));
    }

    [Fact]
    public void AddGroup_UserWithNoConnections_ReturnsEmptyList()
    {
        //act
        List<string> connectionIds = connectionTracker.AddGroup(1, "server_5");

        //assert
        Assert.Empty(connectionIds);
    }

    [Fact]
    public void AddGroupsToConnection_KeepsGroupsAddedBeforeLoadFinished()
    {
        //arrange: the connection registers, joins a server mid-load, then its loaded groups arrive
        connectionTracker.AddConnection(1, "conn1", new List<string>());
        connectionTracker.AddGroup(1, "server_9");

        //act
        connectionTracker.AddGroupsToConnection("conn1", new List<string> { "server_1" });

        //assert
        Assert.True(connectionTracker.IsInGroup("conn1", "server_9"));
        Assert.True(connectionTracker.IsInGroup("conn1", "server_1"));
    }

    //CONCURRENCY
    [Fact]
    public void ConcurrentAddsAndRemoves_ForSameUser_KeepsStateConsistent()
    {
        //arrange
        const int connectionCount = 5000;

        //act: add every connection while groups are changed and read at the same time, then remove the odd ones
        Parallel.For(0, connectionCount, i =>
        {
            connectionTracker.AddConnection(1, $"conn{i}", new List<string> { "server_1" });
            connectionTracker.AddGroup(1, $"server_{i % 10}");
            connectionTracker.IsInGroup($"conn{i}", "server_1");
        });

        Parallel.For(0, connectionCount, i =>
        {
            if(i % 2 == 1)
            {
                connectionTracker.RemoveConnection(1, $"conn{i}", out _);
            }
        });

        //assert
        List<string> remaining = connectionTracker.GetConnections(1);
        Assert.Equal(connectionCount / 2, remaining.Count);
        Assert.All(remaining, connectionId => Assert.True(connectionTracker.IsInGroup(connectionId, "server_1")));
    }

    [Fact]
    public void ConcurrentRemoves_ForSameUser_ReportExactlyOneLastConnection()
    {
        //arrange
        const int connectionCount = 5000;

        for(int i = 0; i < connectionCount; i++)
        {
            connectionTracker.AddConnection(1, $"conn{i}", new List<string>());
        }

        int lastConnectionCount = 0;

        //act
        Parallel.For(0, connectionCount, i =>
        {
            if(connectionTracker.RemoveConnection(1, $"conn{i}", out _))
            {
                Interlocked.Increment(ref lastConnectionCount);
            }
        });

        //assert: only one disconnect should ever set the user offline
        Assert.Equal(1, lastConnectionCount);
        Assert.Empty(connectionTracker.GetConnections(1));
    }
}
