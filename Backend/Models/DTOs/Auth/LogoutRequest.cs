namespace Messaging_App.Models.DTOs.Auth;

public class LogoutRequest
{
    public string refreshToken { get; set; } = string.Empty;
}