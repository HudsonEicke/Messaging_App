using System.ComponentModel.DataAnnotations.Schema;

namespace Messaging_App.Models;

[Table("channels")]
public class Channel
{
    public long id { get; set; }

    [Column("serverid")]
    public long serverID { get; set; }

    [Column("channelname")]
    public string channelName { get; set; } = string.Empty;

    [Column("channelOrder")]
    public int channelOrder { get; set; }
}