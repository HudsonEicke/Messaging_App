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
}
