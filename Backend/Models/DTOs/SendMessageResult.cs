namespace Messaging_App.Models;

public class SendMessageResult
{
    public long id { get; set; }
    public string messageText { get; set; } = string.Empty;
    public string senderUsername { get; set; } = string.Empty;
    public DateTimeOffset timeSent { get; set; }
}