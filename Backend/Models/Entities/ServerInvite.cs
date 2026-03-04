/*
inviteCode UUID PRIMARY KEY DEFAULT gen_random_uuid(),
serverID BIGINT NOT NULL REFERENCES Servers(id) ON DELETE CASCADE,
createdBy BIGINT NOT NULL REFERENCES Users(id),
createdDate TIMESTAMPTZ NOT NULL DEFAULT NOW(),
expiresDate TIMESTAMPTZ,
maxUses INT,
uses INT NOT NULL DEFAULT 0
*/

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