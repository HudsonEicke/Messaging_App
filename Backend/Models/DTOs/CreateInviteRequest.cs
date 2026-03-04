namespace Messaging_App.Models;

public class CreateInviteRequest
{
    public DateTimeOffset? expiresDate { get; set; }
    public int? maxUses { get; set; }
}