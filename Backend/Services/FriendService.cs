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
}
