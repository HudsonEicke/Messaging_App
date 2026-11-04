namespace Messaging_App.Models.DTOs.Servers;

public class CreateServerResult
{
    public long serverID { get; set; }
    public string serverName { get; set; } = string.Empty;
}