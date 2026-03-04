namespace Messaging_App.Models;

public class MessageResult
{
    public long id { get; set; }
    public string messageText { get; set; } = string.Empty;
    public long sender { get; set; }
    public DateTimeOffset timeSent { get; set; }
    public bool edited { get; set; }
}