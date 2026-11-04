namespace Messaging_App.Models.DTOs.Servers;

public class UpdateServerRequest
{
    public string ? serverName { get; set; } = null;
    public string ? serverImageUrl { get; set; } = null;
}