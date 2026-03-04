namespace Messaging_App.Models;

public class ServerResult
{
    public long serverID { get; set; }
    public long ownerID { get; set; }
    public string serverName { get; set; } = string.Empty;
    public string iconUrl { get; set; } = string.Empty;
}