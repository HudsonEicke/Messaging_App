namespace Messaging_App.Models.DTOs.Friends;

public class FriendRequestResult
{
    public FriendStatus status { get; set; }
    public UserResult user { get; set; } = new UserResult();
}
