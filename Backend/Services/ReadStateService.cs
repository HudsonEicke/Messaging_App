using Messaging_App.Data;
using Microsoft.EntityFrameworkCore;

namespace Messaging_App.Services;

public class ReadStateService
{
    private readonly MessagingAppContext db;

    public ReadStateService(MessagingAppContext db)
    {
        this.db = db;
    }

    public async Task MarkConversationRead(long conversationID, long userID, long messageID)
    {
        await db.ConversationMembers.Where(member => member.conversationID == conversationID && member.userID == userID && (member.lastReadMessageID == null || member.lastReadMessageID < messageID)).ExecuteUpdateAsync(setters => setters.SetProperty(member => member.lastReadMessageID, (long?)messageID));
    }

    public async Task MarkChannelRead(long channelID, long userID, long messageID)
    {
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO channelreadstates (userid, channelid, lastreadmessageid) VALUES ({userID}, {channelID}, {messageID}) ON CONFLICT (userid, channelid) DO UPDATE SET lastreadmessageid = GREATEST(channelreadstates.lastreadmessageid, EXCLUDED.lastreadmessageid)");
    }

    public async Task<bool> ChannelHasUnread(long channelID, long userID)
    {
        return await db.Messages.AsNoTracking().AnyAsync(message => message.channelID == channelID && message.id > (db.ChannelReadStates.Where(readState => readState.userID == userID && readState.channelID == channelID).Select(readState => (long?)readState.lastReadMessageID).FirstOrDefault() ?? 0));
    }

    public async Task<bool> ServerHasUnread(long serverID, long userID)
    {
        return await db.Channels.AsNoTracking().AnyAsync(channel => channel.serverID == serverID && db.Messages.Any(message => message.channelID == channel.id && message.id > (db.ChannelReadStates.Where(readState => readState.userID == userID && readState.channelID == channel.id).Select(readState => (long?)readState.lastReadMessageID).FirstOrDefault() ?? 0)));
    }

    public async Task<int> GetConversationUnreadCount(long conversationID, long userID, int maxCount)
    {
        return await db.ConversationMessages.AsNoTracking().Where(message => message.conversationID == conversationID && message.id > (db.ConversationMembers.Where(member => member.conversationID == conversationID && member.userID == userID).Select(member => member.lastReadMessageID).FirstOrDefault() ?? 0)).Take(maxCount).CountAsync();
    }
}
