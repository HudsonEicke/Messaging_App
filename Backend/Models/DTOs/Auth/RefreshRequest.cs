namespace Messaging_App.Models.DTOs.Auth;

public class RefreshRequest
{
    public string refreshToken { get; set; } = string.Empty;
    public string accessToken { get; set; } = string.Empty;
}