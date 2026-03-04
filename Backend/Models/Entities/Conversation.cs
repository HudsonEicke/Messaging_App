using System.ComponentModel.DataAnnotations.Schema;

namespace Messaging_App.Models;

public enum ConversationType
{
    direct,
    group
}

[Table("conversations")]
public class Conversation
{
    public long id { get; set; }
    
    [Column("conversationname")]
    public string? conversationName { get; set; } = null;

    [Column("ownerid")]
    public long? ownerID { get; set; }

    [Column("iconurl")]
    public string? iconUrl { get; set; } = null;
    
    [Column("conversationtype")]
    public ConversationType conversationType { get; set; }
}