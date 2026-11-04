namespace Messaging_App.Models.DTOs.Auth;

public class LoginRequest
{
    public string username {get; set; } = string.Empty;
    public string password {get; set; } = string.Empty;
}