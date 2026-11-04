namespace Messaging_App.Hubs;

//keeps track of which SignalR connections each user has and which groups each connection is in
//every method runs inside one lock and returns copies so callers never read a collection while it changes
public class ConnectionTracker
{
    private readonly object connectionLock = new object();
    private readonly Dictionary<long, HashSet<string>> userConnections = new Dictionary<long, HashSet<string>>();
    private readonly Dictionary<string, HashSet<string>> connectionGroups = new Dictionary<string, HashSet<string>>();

    //returns true if this is the user's first connection
    public bool AddConnection(long userId, string connectionId, List<string> groups)
    {
        lock(connectionLock)
        {
            if(!userConnections.TryGetValue(userId, out HashSet<string>? connections))
            {
                connections = new HashSet<string>();
                userConnections[userId] = connections;
            }

            bool isFirstConnection = connections.Count == 0;
            connections.Add(connectionId);
            connectionGroups[connectionId] = new HashSet<string>(groups);

            return isFirstConnection;
        }
    }

    //returns true if this was the user's last connection, groups are the ones the connection was in
    public bool RemoveConnection(long userId, string connectionId, out List<string> groups)
    {
        lock(connectionLock)
        {
            groups = connectionGroups.Remove(connectionId, out HashSet<string>? removedGroups) ? removedGroups.ToList() : new List<string>();

            if(!userConnections.TryGetValue(userId, out HashSet<string>? connections) || !connections.Remove(connectionId))
            {
                return false;
            }

            if(connections.Count == 0)
            {
                userConnections.Remove(userId);
                return true;
            }

            return false;
        }
    }

    //merges groups into one connection's list, used once a new connection has loaded its groups
    public void AddGroupsToConnection(string connectionId, List<string> groups)
    {
        lock(connectionLock)
        {
            if(connectionGroups.TryGetValue(connectionId, out HashSet<string>? existingGroups))
            {
                existingGroups.UnionWith(groups);
            }
        }
    }

    //adds the group to every connection the user has and returns those connection ids
    public List<string> AddGroup(long userId, string groupName)
    {
        lock(connectionLock)
        {
            if(!userConnections.TryGetValue(userId, out HashSet<string>? connections))
            {
                return new List<string>();
            }

            foreach(string connectionId in connections)
            {
                if(connectionGroups.TryGetValue(connectionId, out HashSet<string>? groups))
                {
                    groups.Add(groupName);
                }
            }

            return connections.ToList();
        }
    }

    //removes the group from every connection the user has and returns those connection ids
    public List<string> RemoveGroup(long userId, string groupName)
    {
        lock(connectionLock)
        {
            if(!userConnections.TryGetValue(userId, out HashSet<string>? connections))
            {
                return new List<string>();
            }

            foreach(string connectionId in connections)
            {
                if(connectionGroups.TryGetValue(connectionId, out HashSet<string>? groups))
                {
                    groups.Remove(groupName);
                }
            }

            return connections.ToList();
        }
    }

    public bool IsInGroup(string connectionId, string groupName)
    {
        lock(connectionLock)
        {
            return connectionGroups.TryGetValue(connectionId, out HashSet<string>? groups) && groups.Contains(groupName);
        }
    }

    public List<string> GetConnections(long userId)
    {
        lock(connectionLock)
        {
            return userConnections.TryGetValue(userId, out HashSet<string>? connections) ? connections.ToList() : new List<string>();
        }
    }
}
