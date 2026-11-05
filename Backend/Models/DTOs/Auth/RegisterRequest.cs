using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Auth;

public class RegisterRequest
{
    [MaxLength(32)]
    public string username {get; set; } = string.Empty;
    [MaxLength(254)]
    public string email {get; set; } = string.Empty;
    [MaxLength(128)]
    public string password {get; set; } = string.Empty;
}