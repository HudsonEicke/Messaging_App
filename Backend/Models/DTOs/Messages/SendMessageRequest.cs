namespace Messaging_App.Models.DTOs.Messages;

public class SendMessageRequest
{
    public string messageText { get; set; } = string.Empty;
    public long? replyToID { get; set; } = null;
}