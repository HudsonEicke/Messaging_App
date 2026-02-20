using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;

namespace Messaging_App.Data;

public class MessagingAppContext : DbContext
{
    public MessagingAppContext (DbContextOptions<MessagingAppContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresEnum<ActivityStatus>();

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.username).IsUnique();
            entity.HasIndex(u => u.email).IsUnique();

            entity.Property(u => u.accountCreationTime).ValueGeneratedOnAdd();
            entity.Property(u => u.activityStatus).HasDefaultValue(ActivityStatus.offline);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.Property(u => u.createdDate).ValueGeneratedOnAdd();
        });
    }
}

