using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Auth;

public class LogoutRequest
{
    [MaxLength(44)]
    public string refreshToken { get; set; } = string.Empty;
}