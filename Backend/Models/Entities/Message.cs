using System.ComponentModel.DataAnnotations.Schema;

namespace Messaging_App.Models;

[Table("messages")]
public class Message
{
    public long id { get; set; }

    [Column("channelid")]
    public long channelID { get; set; }

    [Column("messagetext")]
    public string messageText { get; set; } = string.Empty;

    [Column("sender")]
    public long sender { get; set; }

    [Column("timesent")]
    public DateTimeOffset timeSent { get; set; }

    [Column("edited")]
    public bool edited { get; set; }

    [Column("replytoid")]
    public long? replyToID { get; set; }
}