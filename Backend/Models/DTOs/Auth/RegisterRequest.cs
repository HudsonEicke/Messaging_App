namespace Messaging_App.Models.DTOs.Auth;

public class RegisterRequest
{
    public string username {get; set; } = string.Empty;
    public string email {get; set; } = string.Empty;
    public string password {get; set; } = string.Empty;
}