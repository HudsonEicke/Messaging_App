namespace Messaging_App.Models;

public class CreateInviteResult
{
    public Guid inviteCode { get; set; }
    public DateTimeOffset? expiresDate { get; set; }
    public int? maxUses { get; set; }
}