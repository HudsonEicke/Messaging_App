namespace Messaging_App.Models.DTOs.Channels;

public class ReorderChannelRequest
{
    public List<long> channelIDs { get; set; } = new List<long>();
}