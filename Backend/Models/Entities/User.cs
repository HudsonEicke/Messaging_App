using System.ComponentModel.DataAnnotations.Schema;

namespace Messaging_App.Models;

public enum ActivityStatus
{
    online,
    away,
    dnd,
    offline
}

[Table("users")]
public class User
{
    public long id { get; set; }

    [Column("displayname")]
    public string displayName { get; set; } = string.Empty;

    [Column("username")]
    public string username { get; set; } = string.Empty;

    [Column("email")]
    public string email { get; set; } = string.Empty;
    
    [Column("passwordhash")]
    public string passwordHash { get; set; } = string.Empty;

    [Column("profileimageurl")]
    public string profileImageUrl { get; set; } = string.Empty;

    [Column("activitystatus")]
    public ActivityStatus activityStatus { get; set; }
    
    [Column("accountcreationtime")]
    public DateTimeOffset accountCreationTime { get; set; }
}