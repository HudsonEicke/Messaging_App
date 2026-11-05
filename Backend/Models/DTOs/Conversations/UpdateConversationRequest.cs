using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Conversations;

public class UpdateConversationRequest
{
    [MaxLength(100)]
    public string ? conversationName { get; set; } = null;
    [MaxLength(2048)]
    public string ? conversationImageUrl { get; set; } = null;
}