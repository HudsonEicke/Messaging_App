namespace Messaging_App.Models;

public class InviteResult
{
    public Guid inviteCode { get; set; }
    public long createdBy { get; set; }
    public DateTimeOffset createdDate { get; set; }
    public DateTimeOffset? expiresDate { get; set; }
    public int? maxUses { get; set; }
    public int uses { get; set; }
}