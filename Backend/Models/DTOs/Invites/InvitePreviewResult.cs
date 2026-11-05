namespace Messaging_App.Models.DTOs.Invites;

public class InvitePreviewResult
{
    public long serverID { get; set; }
    public string serverName { get; set; } = string.Empty;
    public string iconUrl { get; set; } = string.Empty;
    public string ownerUsername { get; set; } = string.Empty;
    public int memberCount { get; set; }
}
