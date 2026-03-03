namespace Messaging_App.Models;

public class CreateChannelResult
{
    public long channelID { get; set; }
    public string channelName { get; set; } = string.Empty;
    public int channelOrder { get; set; }
}