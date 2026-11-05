using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Backend.Tests.Helpers;

namespace Backend.Tests.Integration;

public class MessageTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient client;

    public MessageTests(TestWebApplicationFactory factory)
    {
        client = factory.CreateClient();
    }

    private async Task<string> RegisterAndGetToken(string username, string email)
    {
        RegisterRequest request = new RegisterRequest
        {
            username = username,
            email = email,
            password = "Test123!"
        };
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/register", request, TestContext.Current.CancellationToken);
        AuthResult? result = await response.Content.ReadFromJsonAsync<AuthResult>(TestContext.Current.CancellationToken);
        return result!.accessToken;
    }

    private static HttpRequestMessage CreateRequest(HttpMethod method, string url, string token, object? body = null)
    {
        HttpRequestMessage request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }
        return request;
    }

    private async Task<(string token, long serverId)> CreateServerAndGetId(string username)
    {
        string token = await RegisterAndGetToken(username, $"{username}@email.com");
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/servers", token, new CreateServerRequest { serverName = $"{username}server" }),TestContext.Current.CancellationToken);
        CreateServerResult? result = await response.Content.ReadFromJsonAsync<CreateServerResult>(TestContext.Current.CancellationToken);
        return (token, result!.serverID);
    }

    private async Task<(string ownerToken, string memberToken, long serverId)> CreateServerWithMember(string ownerUsername, string memberUsername)
    {
        (string ownerToken, long serverId) = await CreateServerAndGetId(ownerUsername);
        string memberToken = await RegisterAndGetToken(memberUsername, $"{memberUsername}@email.com");
        HttpResponseMessage inviteResponse = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/servers/{serverId}/invites", ownerToken, new CreateInviteRequest()),TestContext.Current.CancellationToken);
        CreateInviteResult? inviteResult = await inviteResponse.Content.ReadFromJsonAsync<CreateInviteResult>(TestContext.Current.CancellationToken);
        await client.SendAsync(CreateRequest(HttpMethod.Post, $"/invites/{inviteResult!.inviteCode}/join", memberToken),TestContext.Current.CancellationToken);
        return (ownerToken, memberToken, serverId);
    }

    private async Task<long> CreateChannel(string ownerToken, long serverId, string channelName)
    {
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/servers/{serverId}/channels", ownerToken, new CreateChannelRequest { channelName = channelName }),TestContext.Current.CancellationToken);
        CreateChannelResult? result = await response.Content.ReadFromJsonAsync<CreateChannelResult>(TestContext.Current.CancellationToken);
        return result!.channelID;
    }

    private async Task<long> SendMessage(string token, long channelId, string messageText)
    {
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/channels/{channelId}/messages", token, new SendMessageRequest { messageText = messageText }),TestContext.Current.CancellationToken);
        SendMessageResult? result = await response.Content.ReadFromJsonAsync<SendMessageResult>(TestContext.Current.CancellationToken);
        return result!.id;
    }

    private async Task<HttpResponseMessage> MarkChannelRead(string token, long channelId, long messageId)
    {
        return await client.SendAsync(CreateRequest(HttpMethod.Put, $"/channels/{channelId}/read-state", token, new UpdateReadStateRequest { lastReadMessageID = messageId }), TestContext.Current.CancellationToken);
    }

    private async Task<bool> ChannelHasUnread(string token, long serverId, long channelId)
    {
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/servers/{serverId}/channels", token), TestContext.Current.CancellationToken);
        List<ChannelResult>? result = await response.Content.ReadFromJsonAsync<List<ChannelResult>>(TestContext.Current.CancellationToken);
        return result!.Single(channel => channel.channelID == channelId).hasUnread;
    }

    //GET MESSAGES
    [Fact]
    public async Task GetMessages_AsMember_ReturnsOkWithEmptyList()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("mggetmsgs");
        long channelId = await CreateChannel(token, serverId, "general");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/channels/{channelId}/messages", token), TestContext.Current.CancellationToken);
        List<MessageResult>? result = await response.Content.ReadFromJsonAsync<List<MessageResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetMessages_AfterSendingMessage_ReturnsOkWithDecryptedMessage()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("mggetmsgsafter");
        long channelId = await CreateChannel(token, serverId, "general");
        await SendMessage(token, channelId, "Hello world");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/channels/{channelId}/messages", token), TestContext.Current.CancellationToken);
        List<MessageResult>? result = await response.Content.ReadFromJsonAsync<List<MessageResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("Hello world", result[0].messageText);
        Assert.Equal("mggetmsgsafter", result[0].senderUsername);
    }

    [Fact]
    public async Task GetMessages_AsNonMember_ReturnsForbidden()
    {
        //arrange
        (string ownerToken, long serverId) = await CreateServerAndGetId("mggetmsgsowner");
        long channelId = await CreateChannel(ownerToken, serverId, "general");
        string nonMemberToken = await RegisterAndGetToken("mggetmsgsnonem", "mggetmsgsnonem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/channels/{channelId}/messages", nonMemberToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetMessages_WithNonExistentChannel_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("mggetmsgsnotf", "mggetmsgsnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/channels/999999999/messages", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetMessages_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/channels/1/messages", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //SEND MESSAGE
    [Fact]
    public async Task SendMessage_AsMember_ReturnsOkWithMessage()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("mgsendmsg");
        long channelId = await CreateChannel(token, serverId, "general");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/channels/{channelId}/messages", token, new SendMessageRequest { messageText = "Hello world" }),TestContext.Current.CancellationToken);
        SendMessageResult? result = await response.Content.ReadFromJsonAsync<SendMessageResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal("Hello world", result.messageText);
        Assert.Equal("mgsendmsg", result.senderUsername);
        Assert.True(result.id > 0);
    }

    [Fact]
    public async Task SendMessage_WithReplyTo_ReturnsOkWithReplyId()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("mgsendreply");
        long channelId = await CreateChannel(token, serverId, "general");
        long originalMessageId = await SendMessage(token, channelId, "Original message");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/channels/{channelId}/messages", token, new SendMessageRequest { messageText = "Reply", replyToID = originalMessageId }),TestContext.Current.CancellationToken);
        SendMessageResult? result = await response.Content.ReadFromJsonAsync<SendMessageResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal(originalMessageId, result.replyToID);
    }

    [Fact]
    public async Task SendMessage_AsNonMember_ReturnsForbidden()
    {
        //arrange
        (string ownerToken, long serverId) = await CreateServerAndGetId("mgsendmsgowner");
        long channelId = await CreateChannel(ownerToken, serverId, "general");
        string nonMemberToken = await RegisterAndGetToken("mgsendmsgnonem", "mgsendmsgnonem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/channels/{channelId}/messages", nonMemberToken, new SendMessageRequest { messageText = "Hello" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task SendMessage_WithEmptyText_ReturnsBadRequest()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("mgsendmsgempty");
        long channelId = await CreateChannel(token, serverId, "general");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/channels/{channelId}/messages", token, new SendMessageRequest { messageText = "" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendMessage_WithNonExistentChannel_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("mgsendmsgnotf", "mgsendmsgnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/channels/999999999/messages", token, new SendMessageRequest { messageText = "Hello" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SendMessage_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/channels/1/messages",new SendMessageRequest { messageText = "Hello" }, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //EDIT MESSAGE
    [Fact]
    public async Task EditMessage_AsSender_ReturnsNoContent()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("mgeditmsg");
        long channelId = await CreateChannel(token, serverId, "general");
        long messageId = await SendMessage(token, channelId, "Original text");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Patch, $"/messages/{messageId}", token, new EditMessageRequest { messageText = "Edited text" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task EditMessage_AsNonSender_ReturnsForbidden()
    {
        //arrange
        (string ownerToken, string memberToken, long serverId) = await CreateServerWithMember("mgeditnonsndr", "mgeditnonsndrmem");
        long channelId = await CreateChannel(ownerToken, serverId, "general");
        long messageId = await SendMessage(ownerToken, channelId, "Owner's message");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Patch, $"/messages/{messageId}", memberToken, new EditMessageRequest { messageText = "Edited by someone else" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task EditMessage_WithEmptyText_ReturnsBadRequest()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("mgeditmsgEmpty");
        long channelId = await CreateChannel(token, serverId, "general");
        long messageId = await SendMessage(token, channelId, "Hello");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Patch, $"/messages/{messageId}", token, new EditMessageRequest { messageText = "" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task EditMessage_WithSameText_ReturnsUnprocessableEntity()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("mgeditmsgSame");
        long channelId = await CreateChannel(token, serverId, "general");
        long messageId = await SendMessage(token, channelId, "Hello");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Patch, $"/messages/{messageId}", token, new EditMessageRequest { messageText = "Hello" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task EditMessage_WithNonExistentMessage_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("mgeditmsgnotf", "mgeditmsgnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Patch, "/messages/999999999", token, new EditMessageRequest { messageText = "Edited text" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task EditMessage_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PatchAsJsonAsync("/messages/1",new EditMessageRequest { messageText = "Edited" }, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //DELETE MESSAGE
    [Fact]
    public async Task DeleteMessage_AsSender_ReturnsNoContent()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("mgdelmsg");
        long channelId = await CreateChannel(token, serverId, "general");
        long messageId = await SendMessage(token, channelId, "Hello");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/messages/{messageId}", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteMessage_AsServerOwner_ReturnsNoContent()
    {
        //arrange
        (string ownerToken, string memberToken, long serverId) = await CreateServerWithMember("mgdelasowner", "mgdelasownermem");
        long channelId = await CreateChannel(ownerToken, serverId, "general");
        long messageId = await SendMessage(memberToken, channelId, "Member's message");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/messages/{messageId}", ownerToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteMessage_AsNonSenderNonOwner_ReturnsForbidden()
    {
        //arrange
        (string ownerToken, string memberToken, long serverId) = await CreateServerWithMember("mgdelnonsndr", "mgdelnonsndrmem");
        long channelId = await CreateChannel(ownerToken, serverId, "general");
        long messageId = await SendMessage(ownerToken, channelId, "Owner's message");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/messages/{messageId}", memberToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DeleteMessage_WithNonExistentMessage_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("mgdelmsgnotf", "mgdelmsgnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, "/messages/999999999", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteMessage_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.DeleteAsync("/messages/1", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //READ STATE
    [Fact]
    public async Task UpdateChannelReadState_AsMember_ClearsUnread()
    {
        //arrange
        (string ownerToken, string memberToken, long serverId) = await CreateServerWithMember("rschreadown", "rschreadmem");
        long channelId = await CreateChannel(ownerToken, serverId, "general");
        long messageId = await SendMessage(ownerToken, channelId, "hello");
        bool unreadBefore = await ChannelHasUnread(memberToken, serverId, channelId);

        //act
        HttpResponseMessage response = await MarkChannelRead(memberToken, channelId, messageId);
        bool unreadAfter = await ChannelHasUnread(memberToken, serverId, channelId);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.True(unreadBefore);
        Assert.False(unreadAfter);
    }

    [Fact]
    public async Task UpdateChannelReadState_WithOlderMessage_DoesNotMoveBackwards()
    {
        //arrange
        (string ownerToken, string memberToken, long serverId) = await CreateServerWithMember("rscholdown", "rscholdmem");
        long channelId = await CreateChannel(ownerToken, serverId, "general");
        long firstMessageId = await SendMessage(ownerToken, channelId, "first");
        long secondMessageId = await SendMessage(ownerToken, channelId, "second");
        await MarkChannelRead(memberToken, channelId, secondMessageId);

        //act
        HttpResponseMessage response = await MarkChannelRead(memberToken, channelId, firstMessageId);
        bool hasUnread = await ChannelHasUnread(memberToken, serverId, channelId);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(hasUnread);
    }

    [Fact]
    public async Task UpdateChannelReadState_WithMessageFromAnotherChannel_ReturnsBadRequest()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("rschother");
        long channelId = await CreateChannel(token, serverId, "general");
        long otherChannelId = await CreateChannel(token, serverId, "other");
        long otherMessageId = await SendMessage(token, otherChannelId, "wrong channel");

        //act
        HttpResponseMessage response = await MarkChannelRead(token, channelId, otherMessageId);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateChannelReadState_AsNonMember_ReturnsForbidden()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("rschnonmown");
        long channelId = await CreateChannel(token, serverId, "general");
        long messageId = await SendMessage(token, channelId, "hello");
        string nonMemberToken = await RegisterAndGetToken("rschnonmem", "rschnonmem@email.com");

        //act
        HttpResponseMessage response = await MarkChannelRead(nonMemberToken, channelId, messageId);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpdateChannelReadState_WithNonExistentChannel_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("rschnotf", "rschnotf@email.com");

        //act
        HttpResponseMessage response = await MarkChannelRead(token, 999999999, 1);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateChannelReadState_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PutAsJsonAsync("/channels/1/read-state", new UpdateReadStateRequest { lastReadMessageID = 1 }, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SendMessage_OwnMessage_DoesNotMarkChannelUnread()
    {
        //arrange
        (string ownerToken, string memberToken, long serverId) = await CreateServerWithMember("rschownown", "rschownmem");
        long channelId = await CreateChannel(ownerToken, serverId, "general");

        //act
        await SendMessage(ownerToken, channelId, "hello");
        bool senderUnread = await ChannelHasUnread(ownerToken, serverId, channelId);
        bool memberUnread = await ChannelHasUnread(memberToken, serverId, channelId);

        //assert
        Assert.False(senderUnread);
        Assert.True(memberUnread);
    }

    [Fact]
    public async Task GetServers_WithUnreadChannel_ReturnsHasUnread()
    {
        //arrange
        (string ownerToken, string memberToken, long serverId) = await CreateServerWithMember("rssvunrown", "rssvunrmem");
        long channelId = await CreateChannel(ownerToken, serverId, "general");
        long messageId = await SendMessage(ownerToken, channelId, "hello");

        //act
        HttpResponseMessage beforeResponse = await client.SendAsync(CreateRequest(HttpMethod.Get, "/servers", memberToken), TestContext.Current.CancellationToken);
        List<ServerResult>? before = await beforeResponse.Content.ReadFromJsonAsync<List<ServerResult>>(TestContext.Current.CancellationToken);
        await MarkChannelRead(memberToken, channelId, messageId);
        HttpResponseMessage afterResponse = await client.SendAsync(CreateRequest(HttpMethod.Get, "/servers", memberToken), TestContext.Current.CancellationToken);
        List<ServerResult>? after = await afterResponse.Content.ReadFromJsonAsync<List<ServerResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.True(before!.Single(server => server.serverID == serverId).hasUnread);
        Assert.False(after!.Single(server => server.serverID == serverId).hasUnread);
    }

    //LIMITS
    [Fact]
    public async Task SendMessage_AtMaxLength_ReturnsOk()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("lmsendmax");
        long channelId = await CreateChannel(token, serverId, "general");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/channels/{channelId}/messages", token, new SendMessageRequest { messageText = new string('a', 2000) }), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SendMessage_OverMaxLength_ReturnsBadRequest()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("lmsendover");
        long channelId = await CreateChannel(token, serverId, "general");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/channels/{channelId}/messages", token, new SendMessageRequest { messageText = new string('a', 2001) }), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task EditMessage_OverMaxLength_ReturnsBadRequest()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("lmeditover");
        long channelId = await CreateChannel(token, serverId, "general");
        long messageId = await SendMessage(token, channelId, "hello");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Patch, $"/messages/{messageId}", token, new EditMessageRequest { messageText = new string('a', 2001) }), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}