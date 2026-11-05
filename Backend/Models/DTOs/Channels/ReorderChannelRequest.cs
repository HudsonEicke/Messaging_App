using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Channels;

public class ReorderChannelRequest
{
    [MaxLength(500)]
    public List<long> channelIDs { get; set; } = new List<long>();
}