using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Backend.Tests.Helpers;
using Messaging_App.Models;

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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", tokenA, new CreateConversationRequest { memberUsernames = [usernameB] }),TestContext.Current.CancellationToken);
        CreateConversationResult? result = await response.Content.ReadFromJsonAsync<CreateConversationResult>(TestContext.Current.CancellationToken);
        return (tokenA, tokenB, result!.conversationID);
    }

    private async Task<long> SendConversationMessage(string token, long conversationId, string messageText)
    {
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/sendmessage", token, new SendMessageRequest { messageText = messageText }),TestContext.Current.CancellationToken);
        SendMessageResult? result = await response.Content.ReadFromJsonAsync<SendMessageResult>(TestContext.Current.CancellationToken);
        return result!.id;
    }

    //GET MESSAGES
    [Fact]
    public async Task GetConversationMessages_AsMember_ReturnsOkWithEmptyList()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmgetmsgs", "cmgetmsgsb");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/conversation/{conversationId}/messages", tokenA),TestContext.Current.CancellationToken);
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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/conversation/{conversationId}/messages", tokenA),TestContext.Current.CancellationToken);
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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/conversation/{conversationId}/messages", nonMemberToken),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetConversationMessages_WithNonExistentConversation_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cmgetmsgsnotf", "cmgetmsgsnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/conversation/999999999/messages", token),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetConversationMessages_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/conversation/1/messages", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //SEND MESSAGE
    [Fact]
    public async Task SendConversationMessage_AsMember_ReturnsOkWithMessage()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmsendmsg", "cmsendmsgb");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/sendmessage", tokenA, new SendMessageRequest { messageText = "Hello world" }),TestContext.Current.CancellationToken);
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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/sendmessage", tokenA, new SendMessageRequest { messageText = "Reply", replyToID = originalMessageId }),TestContext.Current.CancellationToken);
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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/sendmessage", nonMemberToken, new SendMessageRequest { messageText = "Hello" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task SendConversationMessage_WithEmptyText_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cmsendmsgempty", "cmsendmsgemptyb");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/sendmessage", tokenA, new SendMessageRequest { messageText = "" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendConversationMessage_WithNonExistentConversation_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cmsendmsgnotf", "cmsendmsgnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/999999999/sendmessage", token, new SendMessageRequest { messageText = "Hello" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SendConversationMessage_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/conversation/1/sendmessage",new SendMessageRequest { messageText = "Hello" }, TestContext.Current.CancellationToken);

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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, $"/conversationmessage/{messageId}", tokenA, new EditMessageRequest { messageText = "Edited text" }),TestContext.Current.CancellationToken);

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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, $"/conversationmessage/{messageId}", tokenB, new EditMessageRequest { messageText = "Edited by B" }),TestContext.Current.CancellationToken);

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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, $"/conversationmessage/{messageId}", tokenA, new EditMessageRequest { messageText = "" }),TestContext.Current.CancellationToken);

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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, $"/conversationmessage/{messageId}", tokenA, new EditMessageRequest { messageText = "Hello" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task EditConversationMessage_WithNonExistentMessage_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cmeditmsgnotf", "cmeditmsgnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, "/conversationmessage/999999999", token, new EditMessageRequest { messageText = "Edited text" }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task EditConversationMessage_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PutAsJsonAsync("/conversationmessage/1",new EditMessageRequest { messageText = "Edited" }, TestContext.Current.CancellationToken);

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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/conversationmessage/{messageId}", tokenA),TestContext.Current.CancellationToken);

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
        HttpResponseMessage createResponse = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", ownerToken,new CreateConversationRequest{memberUsernames = ["cmdelasownermem", "cmdelasownerm2"], conversationName = "test group"}),TestContext.Current.CancellationToken);
        CreateConversationResult? createResult = await createResponse.Content.ReadFromJsonAsync<CreateConversationResult>(TestContext.Current.CancellationToken);
        long conversationId = createResult!.conversationID;
        long messageId = await SendConversationMessage(memberToken, conversationId, "Member's message");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/conversationmessage/{messageId}", ownerToken),TestContext.Current.CancellationToken);

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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/conversationmessage/{messageId}", tokenB),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DeleteConversationMessage_WithNonExistentMessage_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cmdelmsgnotf", "cmdelmsgnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, "/conversationmessage/999999999", token),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteConversationMessage_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.DeleteAsync("/conversationmessage/1", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
