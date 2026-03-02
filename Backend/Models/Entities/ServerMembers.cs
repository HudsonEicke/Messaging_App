using System.ComponentModel.DataAnnotations.Schema;

namespace Messaging_App.Models;

[Table("servermembers")]
public class ServerMember
{
    [Column("serverid")]
    public long serverID { get; set; }

    [Column("userid")]
    public long userID { get; set; }
}