namespace Messaging_App.Models.DTOs.Users;

public class UpdatePasswordRequest
{
    public string currentPassword { get; set; } = string.Empty;
    public string newPassword { get; set; } = string.Empty;
}