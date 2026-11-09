using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Backend.Tests.Helpers;

namespace Backend.Tests.Integration;

public class ConversationMessageTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient client;

    public ConversationMessageTests(TestWebApplicationFactory factory)
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

    private async Task<(string tokenA, string tokenB, long conversationId)> CreateDmConversation(string usernameA, string usernameB)
    {
        string tokenA = await RegisterAndGetToken(usernameA, $"{usernameA}@email.com");
        string tokenB = await RegisterAndGetToken(usernameB, $"{usernameB}@email.com");
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversations", tokenA, new CreateConversationRequest { memberUsernames = [usernameB] }),TestContext.Current.CancellationToken);
        CreateConversationResult? result = await response.Content.ReadFromJsonAsync<CreateConversationResult>(TestContext.Current.CancellationToken);
        return (tokenA, tokenB, result!.conversationID);
    }

    private async Task<long> SendConversationMessage(string token, long conversationId, string messageText)
    {
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversations/{conversationId}/messages", token, new SendMessageRequest { messageText = messageText }),TestContext.Current.CancellationToken);
        SendMessageResult? result = await response.Content.ReadFromJsonAsync<SendMessageResult>(TestContext.Current.CancellationToken);
        return result!.id;
    }

    private async Task<HttpResponseMessage> MarkConversationRead(string token, long conversationId, long messageId)
    {
        return await client.SendAsync(CreateRequest(HttpMethod.Put, $"/conversations/{conversationId}/read-state", token, new UpdateReadStateRequest { lastReadMessageID = messageId }), TestContext.Current.CancellationToken);
    }

    private async Task<List<ConversationResult>> GetConversations(string token)
    {
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/conversations", token), TestContext.Current.CancellationToken);
        List<ConversationResult>? result = await response.Content.ReadFromJsonAsync<List<ConversationResult>>(TestContext.Current.CancellationToken);
        return result!;
    }

    //GET MESSAGES
    [Fact]
    public async Task GetConversationMessages_AsMember_ReturnsOkWithEmptyList()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmgetmsgs", "cmgetmsgsb");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/conversations/{conversationId}/messages", tokenA),TestContext.Current.CancellationToken);
        List<MessageResult>? result = await response.Content.ReadFromJsonAsync<List<MessageResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetConversationMessages_AfterSendingMessage_ReturnsOkWithDecryptedMessage()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmgetmsgsafter", "cmgetmsgsafterb");
        await SendConversationMessage(tokenA, conversationId, "Hello world");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/conversations/{conversationId}/messages", tokenA),TestContext.Current.CancellationToken);
        List<MessageResult>? result = await response.Content.ReadFromJsonAsync<List<MessageResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("Hello world", result[0].messageText);
        Assert.Equal("cmgetmsgsafter", result[0].senderUsername);
    }

    [Fact]
    public async Task GetConversationMessages_AsNonMember_ReturnsForbidden()
    {
        //arrange
        (_, _, long conversationId) = await CreateDmConversation("cmgetmsgsownr", "cmgetmsgsownrb");
        string nonMemberToken = await RegisterAndGetToken("cmgetmsgsnonem", "cmgetmsgsnonem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/conversations/{conversationId}/messages", nonMemberToken),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetConversationMessages_WithNonExistentConversation_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cmgetmsgsnotf", "cmgetmsgsnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/conversations/999999999/messages", token),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetConversationMessages_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/conversations/1/messages", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetConversationMessages_AfterSendingMessage_ReturnsSenderProfileImage()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmgetmsgsimage", "cmgetmsgsimageb");
        await client.SendAsync(CreateRequest(HttpMethod.Patch, "/users/me", tokenA, new UpdateMeRequest { profileImageUrl = "https://example.com/cmgetmsgsimage.png" }), TestContext.Current.CancellationToken);
        await SendConversationMessage(tokenA, conversationId, "Hello world");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/conversations/{conversationId}/messages", tokenA), TestContext.Current.CancellationToken);
        List<MessageResult>? result = await response.Content.ReadFromJsonAsync<List<MessageResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("https://example.com/cmgetmsgsimage.png", result[0].senderProfileImageUrl);
    }

    [Fact]
    public async Task SendConversationMessage_WithProfileImage_ReturnsSenderProfileImage()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmsendmsgimage", "cmsendmsgimageb");
        await client.SendAsync(CreateRequest(HttpMethod.Patch, "/users/me", tokenA, new UpdateMeRequest { profileImageUrl = "https://example.com/cmsendmsgimage.png" }), TestContext.Current.CancellationToken);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversations/{conversationId}/messages", tokenA, new SendMessageRequest { messageText = "Hello world" }), TestContext.Current.CancellationToken);
        SendMessageResult? result = await response.Content.ReadFromJsonAsync<SendMessageResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal("https://example.com/cmsendmsgimage.png", result.senderProfileImageUrl);
    }

    //SEND MESSAGE
    [Fact]
    public async Task SendConversationMessage_AsMember_ReturnsOkWithMessage()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmsendmsg", "cmsendmsgb");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversations/{conversationId}/messages", tokenA, new SendMessageRequest { messageText = "Hello world" }),TestContext.Current.CancellationToken);
        SendMessageResult? result = await response.Content.ReadFromJsonAsync<SendMessageResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal("Hello world", result.messageText);
        Assert.Equal("cmsendmsg", result.senderUsername);
        Assert.True(result.id > 0);
    }

    [Fact]
    public async Task SendConversationMessage_WithReplyTo_ReturnsOkWithReplyId()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmsendreply", "cmsendreplyb");
        long originalMessageId = await SendConversationMessage(tokenA, conversationId, "Original message");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversations/{conversationId}/messages", tokenA, new SendMessageRequest { messageText = "Reply", replyToID = originalMessageId }),TestContext.Current.CancellationToken);
        SendMessageResult? result = await response.Content.ReadFromJsonAsync<SendMessageResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal(originalMessageId, result.replyToID);
    }

    [Fact]
    public async Task SendConversationMessage_AsNonMember_ReturnsForbidden()
    {
        //arrange
        (_, _, long conversationId) = await CreateDmConversation("cmsendmsgownr", "cmsendmsgownrb");
        string nonMemberToken = await RegisterAndGetToken("cmsendmsgnonem", "cmsendmsgnonem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversations/{conversationId}/messages", nonMemberToken, new SendMessageRequest { messageText = "Hello" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task SendConversationMessage_WithEmptyText_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmsendmsgempty", "cmsendmsgemptyb");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversations/{conversationId}/messages", tokenA, new SendMessageRequest { messageText = "" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendConversationMessage_WithNonExistentConversation_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cmsendmsgnotf", "cmsendmsgnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversations/999999999/messages", token, new SendMessageRequest { messageText = "Hello" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SendConversationMessage_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/conversations/1/messages",new SendMessageRequest { messageText = "Hello" }, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //EDIT MESSAGE
    [Fact]
    public async Task EditConversationMessage_AsSender_ReturnsNoContent()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmeditmsg", "cmeditmsgb");
        long messageId = await SendConversationMessage(tokenA, conversationId, "Original text");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Patch, $"/conversation-messages/{messageId}", tokenA, new EditMessageRequest { messageText = "Edited text" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task EditConversationMessage_AsNonSender_ReturnsForbidden()
    {
        //arrange
        (string tokenA, string tokenB, long conversationId) = await CreateDmConversation("cmeditmsgnsdr", "cmeditnsdrmsgb");
        long messageId = await SendConversationMessage(tokenA, conversationId, "A's message");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Patch, $"/conversation-messages/{messageId}", tokenB, new EditMessageRequest { messageText = "Edited by B" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task EditConversationMessage_WithEmptyText_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmeditmsgEmpty", "cmeditmsgEmptyb");
        long messageId = await SendConversationMessage(tokenA, conversationId, "Hello");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Patch, $"/conversation-messages/{messageId}", tokenA, new EditMessageRequest { messageText = "" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task EditConversationMessage_WithSameText_ReturnsUnprocessableEntity()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmeditmsgSame", "cmeditmsgSameb");
        long messageId = await SendConversationMessage(tokenA, conversationId, "Hello");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Patch, $"/conversation-messages/{messageId}", tokenA, new EditMessageRequest { messageText = "Hello" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task EditConversationMessage_WithNonExistentMessage_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cmeditmsgnotf", "cmeditmsgnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Patch, "/conversation-messages/999999999", token, new EditMessageRequest { messageText = "Edited text" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task EditConversationMessage_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PatchAsJsonAsync("/conversation-messages/1",new EditMessageRequest { messageText = "Edited" }, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //DELETE MESSAGE
    [Fact]
    public async Task DeleteConversationMessage_AsSender_ReturnsNoContent()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmdelmsg", "cmdelmsgb");
        long messageId = await SendConversationMessage(tokenA, conversationId, "Hello");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/conversation-messages/{messageId}", tokenA),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteConversationMessage_AsGroupOwner_ReturnsNoContent()
    {
        //arrange
        string ownerToken = await RegisterAndGetToken("cmdelasowner", "cmdelasowner@email.com");
        string memberToken = await RegisterAndGetToken("cmdelasownermem", "cmdelasownermem@email.com");
        await RegisterAndGetToken("cmdelasownerm2", "cmdelasownerm2@email.com");
        HttpResponseMessage createResponse = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversations", ownerToken,new CreateConversationRequest{memberUsernames = ["cmdelasownermem", "cmdelasownerm2"], conversationName = "test group"}),TestContext.Current.CancellationToken);
        CreateConversationResult? createResult = await createResponse.Content.ReadFromJsonAsync<CreateConversationResult>(TestContext.Current.CancellationToken);
        long conversationId = createResult!.conversationID;
        long messageId = await SendConversationMessage(memberToken, conversationId, "Member's message");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/conversation-messages/{messageId}", ownerToken),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteConversationMessage_AsNonSenderInDm_ReturnsForbidden()
    {
        //arrange
        (string tokenA, string tokenB, long conversationId) = await CreateDmConversation("cmdelnonsndr", "cmdelnonsndrmb");
        long messageId = await SendConversationMessage(tokenA, conversationId, "A's message");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/conversation-messages/{messageId}", tokenB),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DeleteConversationMessage_WithNonExistentMessage_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cmdelmsgnotf", "cmdelmsgnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, "/conversation-messages/999999999", token),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteConversationMessage_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.DeleteAsync("/conversation-messages/1", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //READ STATE
    [Fact]
    public async Task UpdateReadState_AsMember_ResetsUnreadCount()
    {
        //arrange
        (string tokenA, string tokenB, long conversationId) = await CreateDmConversation("rsdmreada", "rsdmreadb");
        await SendConversationMessage(tokenB, conversationId, "first");
        long lastMessageId = await SendConversationMessage(tokenB, conversationId, "second");
        int unreadBefore = (await GetConversations(tokenA)).Single(conversation => conversation.id == conversationId).unreadCount;

        //act
        HttpResponseMessage response = await MarkConversationRead(tokenA, conversationId, lastMessageId);
        int unreadAfter = (await GetConversations(tokenA)).Single(conversation => conversation.id == conversationId).unreadCount;

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(2, unreadBefore);
        Assert.Equal(0, unreadAfter);
    }

    [Fact]
    public async Task UpdateReadState_WithOlderMessage_DoesNotMoveBackwards()
    {
        //arrange
        (string tokenA, string tokenB, long conversationId) = await CreateDmConversation("rsdmolda", "rsdmoldb");
        long firstMessageId = await SendConversationMessage(tokenB, conversationId, "first");
        long secondMessageId = await SendConversationMessage(tokenB, conversationId, "second");
        await MarkConversationRead(tokenA, conversationId, secondMessageId);

        //act
        HttpResponseMessage response = await MarkConversationRead(tokenA, conversationId, firstMessageId);
        int unreadCount = (await GetConversations(tokenA)).Single(conversation => conversation.id == conversationId).unreadCount;

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(0, unreadCount);
    }

    [Fact]
    public async Task UpdateReadState_WithMessageFromAnotherConversation_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("rsdmothera", "rsdmotherb");
        (string tokenC, _, long otherConversationId) = await CreateDmConversation("rsdmotherc", "rsdmotherd");
        long otherMessageId = await SendConversationMessage(tokenC, otherConversationId, "not yours");

        //act
        HttpResponseMessage response = await MarkConversationRead(tokenA, conversationId, otherMessageId);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateReadState_AsNonMember_ReturnsForbidden()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("rsdmnonma", "rsdmnonmb");
        long messageId = await SendConversationMessage(tokenA, conversationId, "hello");
        string nonMemberToken = await RegisterAndGetToken("rsdmnonmc", "rsdmnonmc@email.com");

        //act
        HttpResponseMessage response = await MarkConversationRead(nonMemberToken, conversationId, messageId);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpdateReadState_WithNonExistentConversation_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("rsdmnotf", "rsdmnotf@email.com");

        //act
        HttpResponseMessage response = await MarkConversationRead(token, 999999999, 1);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateReadState_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PutAsJsonAsync("/conversations/1/read-state", new UpdateReadStateRequest { lastReadMessageID = 1 }, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SendConversationMessage_OwnMessages_AreNotUnread()
    {
        //arrange
        (string tokenA, string tokenB, long conversationId) = await CreateDmConversation("rsdmowna", "rsdmownb");

        //act
        await SendConversationMessage(tokenA, conversationId, "first");
        await SendConversationMessage(tokenA, conversationId, "second");
        int senderUnread = (await GetConversations(tokenA)).Single(conversation => conversation.id == conversationId).unreadCount;
        int receiverUnread = (await GetConversations(tokenB)).Single(conversation => conversation.id == conversationId).unreadCount;

        //assert
        Assert.Equal(0, senderUnread);
        Assert.Equal(2, receiverUnread);
    }

    [Fact]
    public async Task GetConversations_OrdersByMostRecentMessage()
    {
        //arrange
        (string tokenA, string tokenB, long firstConversationId) = await CreateDmConversation("rsdmorda", "rsdmordb");
        await RegisterAndGetToken("rsdmordc", "rsdmordc@email.com");
        HttpResponseMessage createResponse = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversations", tokenA, new CreateConversationRequest { memberUsernames = ["rsdmordc"] }), TestContext.Current.CancellationToken);
        long secondConversationId = (await createResponse.Content.ReadFromJsonAsync<CreateConversationResult>(TestContext.Current.CancellationToken))!.conversationID;
        await SendConversationMessage(tokenA, secondConversationId, "older");
        long newestMessageId = await SendConversationMessage(tokenB, firstConversationId, "newer");

        //act
        List<ConversationResult> result = await GetConversations(tokenA);

        //assert
        Assert.Equal(firstConversationId, result[0].id);
        Assert.Equal(secondConversationId, result[1].id);
        Assert.Equal(newestMessageId, result[0].lastMessageID);
    }
}