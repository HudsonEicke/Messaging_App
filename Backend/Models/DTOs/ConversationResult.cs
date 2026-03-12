namespace Messaging_App.Models;

public class ConversationResult
{
    public long id { get; set; }
    public string? ownerUsername { get; set; } = null;
    public string conversationName { get; set; } = string.Empty;
    public string? iconUrl { get; set; } = string.Empty;
    public ConversationType conversationType { get; set; }
}