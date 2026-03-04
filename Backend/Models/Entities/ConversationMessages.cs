using System.ComponentModel.DataAnnotations.Schema;

namespace Messaging_App.Models;

[Table("conversationmessages")]
public class ConversationMessage
{
    public long id { get; set; }

    [Column("conversationid")]
    public long conversationID { get; set; }

    [Column("messagetext")]
    public string messageText { get; set; } = string.Empty;

    [Column("sender")]
    public long sender { get; set; }

    [Column("timesent")]
    public DateTimeOffset timeSent { get; set; }

    [Column("edited")]
    public bool edited { get; set; }
}