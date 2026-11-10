using Messaging_App.Data;
using Microsoft.EntityFrameworkCore;

namespace Messaging_App.Services;

public class FriendService
{
    private readonly MessagingAppContext db;

    public FriendService(MessagingAppContext db)
    {
        this.db = db;
    }

    //as strings, the form Clients.Users expects
    public async Task<List<string>> GetFriendUserIds(long userID)
    {
        List<long> friendIds = await db.Friends.AsNoTracking().Where(friend => (friend.sender == userID || friend.receiver == userID) && friend.status == FriendStatus.friends).Select(friend => friend.sender == userID ? friend.receiver : friend.sender).ToListAsync();

        return friendIds.Select(friendId => friendId.ToString()).ToList();
    }

    //true if either user has blocked the other
    public async Task<bool> IsBlockedBetween(long firstUserID, long secondUserID)
    {
        return await db.Friends.AsNoTracking().AnyAsync(friend => friend.status == FriendStatus.blocked && ((friend.sender == firstUserID && friend.receiver == secondUserID) || (friend.sender == secondUserID && friend.receiver == firstUserID)));
    }

    //the ids in otherUserIDs that have a block with userID in either direction
    public async Task<List<long>> GetBlockedAmong(long userID, List<long> otherUserIDs)
    {
        return await db.Friends.AsNoTracking().Where(friend => friend.status == FriendStatus.blocked && ((friend.sender == userID && otherUserIDs.Contains(friend.receiver)) || (friend.receiver == userID && otherUserIDs.Contains(friend.sender)))).Select(friend => friend.sender == userID ? friend.receiver : friend.sender).ToListAsync();
    }
}
