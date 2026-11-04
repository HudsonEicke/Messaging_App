using System.ComponentModel.DataAnnotations.Schema;

namespace Messaging_App.Models.Entities;

[Table("channelreadstates")]
public class ChannelReadState
{
    [Column("userid")]
    public long userID { get; set; }

    [Column("channelid")]
    public long channelID { get; set; }

    [Column("lastreadmessageid")]
    public long lastReadMessageID { get; set; }
}