using System.ComponentModel.DataAnnotations.Schema;

namespace Messaging_App.Models;

public enum FriendStatus
{
    pending,
    friends,
    blocked
}

[Table("friends")]
public class Friend
{
    [Column("sender")]
    public long sender { get; set; }

    [Column("receiver")]
    public long receiver { get; set; }

    [Column("status")]
    public FriendStatus status { get; set; }
}
