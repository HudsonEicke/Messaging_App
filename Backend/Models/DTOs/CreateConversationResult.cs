namespace Messaging_App.Models;

public class CreateConversationResult
{
    public long conversationID { get; set; }
    public string conversationName { get; set; } = string.Empty;
    public string? ownerUsername { get; set; } = null;
    public string? iconUrl { get; set; } = null;
    public ConversationType conversationType { get; set; }
    public List<string> memberUsernames { get; set; } = new List<string>();
}