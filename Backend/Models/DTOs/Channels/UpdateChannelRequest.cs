using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Channels;

public class UpdateChannelRequest
{
    [MaxLength(100)]
    public string ? channelName { get; set; } = null;
}