namespace Messaging_App.Models;

public class AuthResult
{
    public bool success { get; set; } = false;
    public string message { get; set; } = string.Empty;
    public string refreshToken { get; set; } = string.Empty;
    public string accessToken { get; set; } = string.Empty;
}
