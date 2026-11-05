using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Auth;

public class RefreshRequest
{
    [MaxLength(44)]
    public string refreshToken { get; set; } = string.Empty;
    [MaxLength(2048)]
    public string accessToken { get; set; } = string.Empty;
}