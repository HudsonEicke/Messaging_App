namespace Messaging_App.Models;

public class CreateConversationRequest
{
    public string conversationName { get; set; } = string.Empty;
    public string? iconUrl { get; set; } = null;
    public List<string> memberUsernames { get; set; } = new List<string>();
}