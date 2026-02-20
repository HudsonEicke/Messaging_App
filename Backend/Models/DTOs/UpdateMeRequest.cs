using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models;

public class UpdateMeRequest
{
    [MaxLength(100)]
    public string ? displayName { get; set; } = null;
    public string ? profileImageUrl { get; set; } = null;
}