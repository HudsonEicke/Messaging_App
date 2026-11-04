namespace Messaging_App.Models.DTOs.Servers;

public class ServerResult
{
    public long serverID { get; set; }
    public string ownerUsername { get; set; } = string.Empty;
    public string serverName { get; set; } = string.Empty;
    public string iconUrl { get; set; } = string.Empty;
    public bool hasUnread { get; set; }
}