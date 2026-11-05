using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Auth;

public class LoginRequest
{
    [MaxLength(32)]
    public string username {get; set; } = string.Empty;
    [MaxLength(128)]
    public string password {get; set; } = string.Empty;
}