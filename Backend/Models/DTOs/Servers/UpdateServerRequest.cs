using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Models.DTOs.Servers;

public class UpdateServerRequest
{
    [MaxLength(100)]
    public string ? serverName { get; set; } = null;
    [MaxLength(2048)]
    public string ? iconUrl { get; set; } = null;
}