using System.ComponentModel.DataAnnotations.Schema;

namespace Messaging_App.Models.Entities;

[Table("conversationmembers")]
public class ConversationMember
{
    [Column("conversationid")]
    public long conversationID { get; set; }

    [Column("userid")]
    public long userID { get; set; }
}