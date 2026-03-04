namespace Messaging_App.Models;

public class ServerResult
{
    public long serverID { get; set; }
    public string ownerUsername { get; set; } = string.Empty;
    public string serverName { get; set; } = string.Empty;
    public string iconUrl { get; set; } = string.Empty;
}