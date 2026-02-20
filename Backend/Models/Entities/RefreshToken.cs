using System.ComponentModel.DataAnnotations.Schema;

namespace Messaging_App.Models;

[Table("refreshtokens")]
public class RefreshToken
{
    public long id { get; set; }

    [Column("userid")]
    public long userID { get; set; }

    [Column("token")]
    public string token { get; set; } = string.Empty;

    [Column("revoked")]
    public bool revoked { get; set; }

    [Column("createddate")]
    public DateTimeOffset createdDate { get; set; }

    [Column("expiresdate")]
    public DateTimeOffset expiresDate { get; set; }
}