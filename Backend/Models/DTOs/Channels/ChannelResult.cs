namespace Messaging_App.Models.DTOs.Channels;

public class ChannelResult
{
    public long channelID { get; set; }
    public string channelName { get; set; } = string.Empty;
    public int channelOrder { get; set; }
}