using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Channels;

public class CreateChannelRequest
{
    [MaxLength(100)]
    public string channelName { get; set; } = string.Empty;
}