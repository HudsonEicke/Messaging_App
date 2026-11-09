namespace Messaging_App.Models.DTOs.Messages;

public class SendMessageResult
{
    public long id { get; set; }
    public string messageText { get; set; } = string.Empty;
    public string senderUsername { get; set; } = string.Empty;
    public string senderDisplayName { get; set; } = string.Empty;
    public string senderProfileImageUrl { get; set; } = string.Empty;
    public DateTimeOffset timeSent { get; set; }
    public long? replyToID { get; set; } = null;
    public MessageReplyPreview? replyTo { get; set; } = null;
}