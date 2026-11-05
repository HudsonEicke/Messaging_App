using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Messages;

public class SendMessageRequest
{
    [MaxLength(2000)]
    public string messageText { get; set; } = string.Empty;
    public long? replyToID { get; set; } = null;
}