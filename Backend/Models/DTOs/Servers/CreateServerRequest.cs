using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Servers;

public class CreateServerRequest
{
    [MaxLength(100)]
    public string serverName { get; set; } = string.Empty;
}