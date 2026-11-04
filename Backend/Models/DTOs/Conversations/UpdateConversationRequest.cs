namespace Messaging_App.Models.DTOs.Conversations;

public class UpdateConversationRequest
{
    public string ? conversationName { get; set; } = null;
    public string ? conversationImageUrl { get; set; } = null;
}