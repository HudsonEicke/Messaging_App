using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Users;

public class UpdatePasswordRequest
{
    [MaxLength(128)]
    public string currentPassword { get; set; } = string.Empty;
    [MinLength(8)]
    [MaxLength(128)]
    public string newPassword { get; set; } = string.Empty;
}