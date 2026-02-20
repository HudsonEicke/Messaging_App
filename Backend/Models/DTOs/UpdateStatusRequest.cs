namespace Messaging_App.Models;

public class UpdateStatusRequest
{
    public ActivityStatus newStatus { get; set; } = ActivityStatus.offline;
}