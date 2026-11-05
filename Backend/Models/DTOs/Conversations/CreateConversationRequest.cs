using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Conversations;

public class CreateConversationRequest
{
    [MaxLength(100)]
    public string conversationName { get; set; } = string.Empty;
    [MaxLength(2048)]
    public string? iconUrl { get; set; } = null;
    public List<string> memberUsernames { get; set; } = new List<string>();
}