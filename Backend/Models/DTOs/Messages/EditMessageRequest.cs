using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Messages;

public class EditMessageRequest
{
    [MaxLength(2000)]
    public string messageText { get; set; } = string.Empty;
}