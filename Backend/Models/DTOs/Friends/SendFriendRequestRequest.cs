using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Friends;

public class SendFriendRequestRequest
{
    [MaxLength(32)]
    public string username { get; set; } = string.Empty;
}
