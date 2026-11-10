using System.ComponentModel.DataAnnotations;

namespace Messaging_App.Configuration;

public class CleanupSettings
{
    //turned off for integration tests so no deletes run against the database while they do
    public bool Enabled { get; set; } = true;

    [Range(1, 24 * 7)]
    public int IntervalHours { get; set; } = 24;

    //how long an expired or used-up invite stays listed in the owner's settings before it's removed
    [Range(1, 365)]
    public int InviteRetentionDays { get; set; } = 30;
}
