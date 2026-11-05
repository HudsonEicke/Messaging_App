using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Conversations;

public class AddConversationMemberRequest
{
    [MaxLength(32)]
    public string username { get; set; } = string.Empty;
}
