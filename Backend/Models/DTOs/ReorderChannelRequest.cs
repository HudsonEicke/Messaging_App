namespace Messaging_App.Models;

public class ReorderChannelRequest
{
    public List<long> channelIDs { get; set; } = new List<long>();
}