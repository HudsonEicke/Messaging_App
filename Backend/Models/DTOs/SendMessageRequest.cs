namespace Messaging_App.Models;

public class SendMessageRequest
{
    public string messageText { get; set; } = string.Empty;
    public long? replyToID { get; set; } = null;
}