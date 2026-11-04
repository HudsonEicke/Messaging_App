using System.ComponentModel.DataAnnotations.Schema;

namespace Messaging_App.Models.Entities;

[Table("servers")]
public class Server
{
    public long id { get; set; }

    [Column("servername")]
    public string serverName { get; set; } = string.Empty;

    [Column("ownerid")]
    public long ownerID { get; set; }

    [Column("iconurl")]
    public string iconUrl { get; set; } = string.Empty;

    public List<ServerMember> members { get; set; } = new List<ServerMember>();
}