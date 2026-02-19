namespace Messaging_App.Models;

public class RegisterRequest
{
    public string username {get; set; } = string.Empty;
    public string email {get; set; } = string.Empty;
    public string password {get; set; } = string.Empty;
}