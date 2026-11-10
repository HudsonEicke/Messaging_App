using Messaging_App.Configuration;
using Messaging_App.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Messaging_App.Services;

//runs once at startup and then every IntervalHours, removing rows nothing will use again
public class DatabaseCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory scopeFactory;
    private readonly ILogger<DatabaseCleanupService> logger;
    private readonly CleanupSettings cleanupSettings;

    public DatabaseCleanupService(IServiceScopeFactory scopeFactory, ILogger<DatabaseCleanupService> logger, IOptions<CleanupSettings> cleanupSettings)
    {
        this.scopeFactory = scopeFactory;
        this.logger = logger;
        this.cleanupSettings = cleanupSettings.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if(!cleanupSettings.Enabled)
        {
            return;
        }

        using PeriodicTimer timer = new PeriodicTimer(TimeSpan.FromHours(cleanupSettings.IntervalHours));

        do
        {
            await RunCleanup(stoppingToken);
        }
        while(await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task RunCleanup(CancellationToken stoppingToken)
    {
        try
        {
            //the hosted service is a singleton and the DbContext is scoped, so each run gets its own scope
            await using AsyncServiceScope scope = scopeFactory.CreateAsyncScope();
            MessagingAppContext db = scope.ServiceProvider.GetRequiredService<MessagingAppContext>();

            DateTimeOffset now = DateTimeOffset.UtcNow;
            DateTimeOffset inviteCutoff = now.AddDays(-cleanupSettings.InviteRetentionDays);

            //revoked tokens that haven't expired are kept, since Refresh uses them to spot a stolen token being reused
            int deletedTokens = await db.RefreshTokens.Where(token => token.expiresDate < now).ExecuteDeleteAsync(stoppingToken);

            //there's no time an invite ran out of uses, so a used-up one goes by when it was created
            int deletedInvites = await db.ServerInvites.Where(invite => (invite.expiresDate != null && invite.expiresDate < inviteCutoff) || (invite.maxUses != null && invite.uses >= invite.maxUses && invite.createdDate < inviteCutoff)).ExecuteDeleteAsync(stoppingToken);

            logger.LogInformation("Database cleanup removed {DeletedTokens} expired refresh tokens and {DeletedInvites} old invites", deletedTokens, deletedInvites);
        }
        //an unhandled exception here would stop the whole app, so a failed run is logged and retried next interval
        catch(Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogError(exception, "Database cleanup failed; it will run again next interval");
        }
    }
}
