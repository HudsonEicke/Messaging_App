using Microsoft.EntityFrameworkCore;

namespace Messaging_App.Data;

public class MessagingAppContext : DbContext
{
    public MessagingAppContext (DbContextOptions<MessagingAppContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<Server> Servers { get; set; }
    public DbSet<ServerMember> ServerMembers { get; set; }
    public DbSet<Channel> Channels { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<ServerInvite> ServerInvites { get; set; }
    public DbSet<Conversation> Conversations { get; set; }
    public DbSet<ConversationMember> ConversationMembers { get; set; }
    public DbSet<ConversationMessage> ConversationMessages { get; set; }
    public DbSet<Friend> Friends { get; set; }
    public DbSet<ChannelReadState> ChannelReadStates { get; set; }

    public async Task LockServerAsync(long serverId)
    {
        await Database.ExecuteSqlInterpolatedAsync($"SELECT id FROM servers WHERE id = {serverId} FOR UPDATE");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresEnum<ActivityStatus>();
        modelBuilder.HasPostgresEnum<ConversationType>();
        modelBuilder.HasPostgresEnum<FriendStatus>();

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.username).IsUnique();
            entity.HasIndex(u => u.email).IsUnique();

            entity.Property(u => u.accountCreationTime).ValueGeneratedOnAdd();
            entity.Property(u => u.activityStatus).HasDefaultValue(ActivityStatus.online);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.Property(u => u.createdDate).ValueGeneratedOnAdd();
        });

        modelBuilder.Entity<ServerMember>(entity =>
        {
            entity.HasKey(sm => new { sm.serverID, sm.userID });
            entity.HasOne<Server>().WithMany(server => server.members).HasForeignKey(sm => sm.serverID);
        });

        modelBuilder.Entity<Message>(entity =>
        {
           entity.Property(m => m.timeSent).ValueGeneratedOnAdd(); 
        });

        modelBuilder.Entity<ServerInvite>(entity =>
        {
            entity.HasKey(si => si.inviteCode);
            entity.Property(si => si.inviteCode).ValueGeneratedOnAdd();
            entity.Property(si => si.createdDate).ValueGeneratedOnAdd();
        });

        modelBuilder.Entity<Conversation>(entity =>
        {
            entity.Property(c => c.conversationType).HasDefaultValue(ConversationType.direct);
        });

        modelBuilder.Entity<ConversationMember>(entity =>
        {
            entity.HasKey(cm => new { cm.conversationID, cm.userID });
            entity.HasOne<Conversation>().WithMany(conversation => conversation.members).HasForeignKey(cm => cm.conversationID);
        });

        modelBuilder.Entity<ChannelReadState>(entity =>
        {
            entity.HasKey(rs => new { rs.userID, rs.channelID });
        });

        modelBuilder.Entity<ConversationMessage>(entity =>
        {
            entity.Property(cm => cm.timeSent).ValueGeneratedOnAdd();
        });

        modelBuilder.Entity<Friend>(entity =>
        {
            entity.HasKey(f => new { f.sender, f.receiver });
        });
    }
}

