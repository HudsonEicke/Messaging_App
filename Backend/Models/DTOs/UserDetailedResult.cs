namespace Messaging_App.Models;

public class UserDetailedResult
{
    public string displayName { get; set; } = string.Empty;
    public string username { get; set; } = string.Empty;
    public string profileImageUrl { get; set; } = string.Empty;
    public ActivityStatus activityStatus { get; set; }
    public DateTimeOffset accountCreationTime { get; set; }
}
