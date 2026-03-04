using System.ComponentModel.DataAnnotations.Schema;

namespace Messaging_App.Models;

[Table("serverinvites")]
public class ServerInvite
{
    [Column("invitecode")]
    public Guid inviteCode { get; set; }

    [Column("serverid")]
    public long serverID { get; set; }

    [Column("createdby")]
    public long createdBy { get; set; }

    [Column("createddate")]
    public DateTimeOffset createdDate { get; set; }

    [Column("expiresdate")]
    public DateTimeOffset? expiresDate { get; set; }

    [Column("maxuses")]
    public int? maxUses { get; set; }

    [Column("uses")]
    public int uses { get; set; }
}