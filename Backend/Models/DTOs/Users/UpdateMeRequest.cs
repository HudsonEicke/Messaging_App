using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Users;

public class UpdateMeRequest
{
    [MaxLength(32)]
    public string ? displayName { get; set; } = null;
    [MaxLength(2048)]
    public string ? profileImageUrl { get; set; } = null;
}