using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Backend.Tests.Helpers;
using Messaging_App.Models;

namespace Backend.Tests.Integration;

public class ConversationTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient client;

    public ConversationTests(TestWebApplicationFactory factory)
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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", tokenA, new CreateConversationRequest { memberUsernames = new List<string> { usernameB } }),TestContext.Current.CancellationToken);
        CreateConversationResult? result = await response.Content.ReadFromJsonAsync<CreateConversationResult>(TestContext.Current.CancellationToken);
        return (tokenA, tokenB, result!.conversationID);
    }

    // memberUsernames must have 2+ entries to create a group (1 entry creates a DM)
    private async Task<(string ownerToken, long conversationId)> CreateGroupConversation(string ownerUsername, List<string> memberUsernames)
    {
        string ownerToken = await RegisterAndGetToken(ownerUsername, $"{ownerUsername}@email.com");
        foreach (string member in memberUsernames)
            await RegisterAndGetToken(member, $"{member}@email.com");
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", ownerToken, new CreateConversationRequest { memberUsernames = memberUsernames }),TestContext.Current.CancellationToken);
        CreateConversationResult? result = await response.Content.ReadFromJsonAsync<CreateConversationResult>(TestContext.Current.CancellationToken);
        return (ownerToken, result!.conversationID);
    }

    //CREATE CONVERSATION
    [Fact]
    public async Task CreateConversation_DirectWithValidUser_ReturnsOkWithResult()
    {
        //arrange
        string tokenA = await RegisterAndGetToken("cvdirectA", "cvdirectA@email.com");
        await RegisterAndGetToken("cvdirectB", "cvdirectB@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", tokenA, new CreateConversationRequest { memberUsernames = new List<string> { "cvdirectB" } }),TestContext.Current.CancellationToken);
        CreateConversationResult? result = await response.Content.ReadFromJsonAsync<CreateConversationResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal(ConversationType.direct, result.conversationType);
        Assert.Contains("cvdirectA", result.memberUsernames);
        Assert.Contains("cvdirectB", result.memberUsernames);
    }

    [Fact]
    public async Task CreateConversation_DirectWithSelf_ReturnsForbidden()
    {
        //arrange
        string token = await RegisterAndGetToken("cvdirself", "cvdirself@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", token, new CreateConversationRequest { memberUsernames = new List<string> { "cvdirself" } }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateConversation_DirectWithNonExistentUser_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cvdirnotf", "cvdirnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", token, new CreateConversationRequest { memberUsernames = new List<string> { "nonexistentuser99999" } }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateConversation_DirectWhenAlreadyExists_ReturnsConflict()
    {
        //arrange
        (string tokenA, _, _) = await CreateDmConversation("cvdirdupeA", "cvdirdupeB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", tokenA, new CreateConversationRequest { memberUsernames = new List<string> { "cvdirdupeB" } }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task CreateConversation_GroupWithValidUsers_ReturnsOkWithResult()
    {
        //arrange
        string ownerToken = await RegisterAndGetToken("cvgroupowner", "cvgroupowner@email.com");
        await RegisterAndGetToken("cvgroupmem1", "cvgroupmem1@email.com");
        await RegisterAndGetToken("cvgroupmem2", "cvgroupmem2@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", ownerToken, new CreateConversationRequest{conversationName = "Test Group", memberUsernames = new List<string> { "cvgroupmem1", "cvgroupmem2" }}),TestContext.Current.CancellationToken);
        CreateConversationResult? result = await response.Content.ReadFromJsonAsync<CreateConversationResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal(ConversationType.group, result.conversationType);
        Assert.Equal("Test Group", result.conversationName);
        Assert.Equal("cvgroupowner", result.ownerUsername);
    }

    [Fact]
    public async Task CreateConversation_GroupWithSelfIncluded_ReturnsForbidden()
    {
        //arrange
        string ownerToken = await RegisterAndGetToken("cvgrpself", "cvgrpself@email.com");
        await RegisterAndGetToken("cvgrpselfmem", "cvgrpselfmem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", ownerToken, new CreateConversationRequest { memberUsernames = new List<string> { "cvgrpselfmem", "cvgrpself" } }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateConversation_GroupWithNonExistentUser_ReturnsNotFound()
    {
        //arrange
        string ownerToken = await RegisterAndGetToken("cvgrpnotf", "cvgrpnotf@email.com");
        await RegisterAndGetToken("cvgrpnotfmem", "cvgrpnotfmem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", ownerToken, new CreateConversationRequest { memberUsernames = new List<string> { "cvgrpnotfmem", "nonexistentuser99999" } }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateConversation_WithEmptyMemberList_ReturnsBadRequest()
    {
        //arrange
        string token = await RegisterAndGetToken("cvemptylist", "cvemptylist@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", token, new CreateConversationRequest { memberUsernames = new List<string>() }),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateConversation_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/conversation/createconversation",new CreateConversationRequest { memberUsernames = new List<string> { "someuser" } },TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //GET CONVERSATIONS
    [Fact]
    public async Task GetConversations_WithConversations_ReturnsOkWithList()
    {
        //arrange
        (string token, _, _) = await CreateDmConversation("cvgetconvsA", "cvgetconvsB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/conversation/conversations", token), TestContext.Current.CancellationToken);
        List<ConversationResult>? result = await response.Content.ReadFromJsonAsync<List<ConversationResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.NotEmpty(result);
    }

    [Fact]
    public async Task GetConversations_WhenNone_ReturnsEmptyList()
    {
        //arrange
        string token = await RegisterAndGetToken("cvgetconvsmt", "cvgetconvsmt@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/conversation/conversations", token), TestContext.Current.CancellationToken);
        List<ConversationResult>? result = await response.Content.ReadFromJsonAsync<List<ConversationResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetConversations_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/conversation/conversations", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //GET CONVERSATION
    [Fact]
    public async Task GetConversation_WhenMember_ReturnsOkWithResult()
    {
        //arrange
        (string token, _, long conversationId) = await CreateDmConversation("cvgetconvA", "cvgetconvB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/conversation/{conversationId}", token), TestContext.Current.CancellationToken);
        ConversationResult? result = await response.Content.ReadFromJsonAsync<ConversationResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal(conversationId, result.id);
        Assert.Equal(ConversationType.direct, result.conversationType);
    }

    [Fact]
    public async Task GetConversation_WhenNotMember_ReturnsForbidden()
    {
        //arrange
        (_, _, long conversationId) = await CreateDmConversation("cvgetconvownr", "cvgetconvownrB");
        string nonMemberToken = await RegisterAndGetToken("cvgetconvnonem", "cvgetconvnonem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/conversation/{conversationId}", nonMemberToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetConversation_WithNonExistentId_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cvgetconvnotf", "cvgetconvnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/conversation/999999999", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetConversation_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/conversation/1", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //GET CONVERSATION MEMBERS
    [Fact]
    public async Task GetConversationMembers_WhenMember_ReturnsOkWithList()
    {
        //arrange
        (string token, _, long conversationId) = await CreateDmConversation("cvgetmemA", "cvgetmemB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/conversation/{conversationId}/members", token), TestContext.Current.CancellationToken);
        List<UserResult>? result = await response.Content.ReadFromJsonAsync<List<UserResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetConversationMembers_WhenNotMember_ReturnsForbidden()
    {
        //arrange
        (_, _, long conversationId) = await CreateDmConversation("cvgetmemownr", "cvgetmemownrB");
        string nonMemberToken = await RegisterAndGetToken("cvgetmemnonem", "cvgetmemnonem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/conversation/{conversationId}/members", nonMemberToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetConversationMembers_WithNonExistentId_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cvgetmemnotf", "cvgetmemnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/conversation/999999999/members", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetConversationMembers_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/conversation/1/members", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //ADD MEMBER
    [Fact]
    public async Task AddMember_AsOwnerToGroupConversation_ReturnsOkWithUserResult()
    {
        //arrange
        (string ownerToken, long conversationId) = await CreateGroupConversation("cvaddowner", new List<string> { "cvaddmem", "cvaddmem2" });
        await RegisterAndGetToken("cvaddnewmem", "cvaddnewmem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/members/cvaddnewmem", ownerToken),TestContext.Current.CancellationToken);
        UserResult? result = await response.Content.ReadFromJsonAsync<UserResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal("cvaddnewmem", result.username);
    }

    [Fact]
    public async Task AddMember_AsNonOwner_ReturnsForbidden()
    {
        //arrange — register manually to obtain member token; group needs 2+ members
        string ownerToken = await RegisterAndGetToken("cvaddnonownr", "cvaddnonownr@email.com");
        string memberToken = await RegisterAndGetToken("cvaddnonownrmem", "cvaddnonownrmem@email.com");
        await RegisterAndGetToken("cvaddnonownrm2", "cvaddnonownrm2@email.com");
        HttpResponseMessage createResponse = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", ownerToken, new CreateConversationRequest { memberUsernames = ["cvaddnonownrmem", "cvaddnonownrm2"] }),TestContext.Current.CancellationToken);
        CreateConversationResult? conv = await createResponse.Content.ReadFromJsonAsync<CreateConversationResult>(TestContext.Current.CancellationToken);
        await RegisterAndGetToken("cvaddnonownradd", "cvaddnonownradd@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conv!.conversationID}/members/cvaddnonownradd", memberToken),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AddMember_ToDirectConversation_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cvadddmA", "cvadddmB");
        await RegisterAndGetToken("cvadddmnew", "cvadddmnew@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/members/cvadddmnew", tokenA),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddMember_WhenAlreadyMember_ReturnsConflict()
    {
        //arrange
        (string ownerToken, long conversationId) = await CreateGroupConversation("cvaddalready", ["cvaddalreadymem", "cvaddalreadym2"]);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/members/cvaddalreadymem", ownerToken),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task AddMember_WithNonExistentUser_ReturnsNotFound()
    {
        //arrange
        (string ownerToken, long conversationId) = await CreateGroupConversation("cvaddnotfuser", ["cvaddnotfusrmem", "cvaddnotfusrm2"]);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/members/nonexistentuser99999", ownerToken),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddMember_WithNonExistentConversation_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cvaddnoconv", "cvaddnoconv@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/999999999/members/someuser", token),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddMember_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsync("/conversation/1/members/someuser", null, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //LEAVE CONVERSATION
    [Fact]
    public async Task LeaveConversation_AsDmMember_ReturnsNoContent()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cvleavedmA", "cvleavedmB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/leave", tokenA), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task LeaveConversation_AsGroupNonOwner_ReturnsNoContent()
    {
        //arrange — register manually to obtain member token; group needs 2+ members
        string ownerToken = await RegisterAndGetToken("cvleavegrpown", "cvleavegrpown@email.com");
        string memberToken = await RegisterAndGetToken("cvleavegrpmem", "cvleavegrpmem@email.com");
        await RegisterAndGetToken("cvleavegrpmem2", "cvleavegrpmem2@email.com");
        HttpResponseMessage createResponse = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", ownerToken, new CreateConversationRequest { memberUsernames = ["cvleavegrpmem", "cvleavegrpmem2"] }),TestContext.Current.CancellationToken);
        CreateConversationResult? conv = await createResponse.Content.ReadFromJsonAsync<CreateConversationResult>(TestContext.Current.CancellationToken);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conv!.conversationID}/leave", memberToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task LeaveConversation_AsLastDmMember_DeletesConversationAndReturnsNoContent()
    {
        //arrange — B leaves first, then A leaves as the last remaining member
        (string tokenA, string tokenB, long conversationId) = await CreateDmConversation("cvleavelastA", "cvleavelastB");
        await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/leave", tokenB), TestContext.Current.CancellationToken);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/leave", tokenA), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task LeaveConversation_WhenNotMember_ReturnsForbidden()
    {
        //arrange
        (_, _, long conversationId) = await CreateDmConversation("cvleavenotmA", "cvleavenotmB");
        string nonMemberToken = await RegisterAndGetToken("cvleavenotmem", "cvleavenotmem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/conversation/{conversationId}/leave", nonMemberToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task LeaveConversation_WithNonExistentConversation_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cvleavenotconv", "cvleavenotconv@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/999999999/leave", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task LeaveConversation_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsync("/conversation/1/leave", null, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //UPDATE CONVERSATION
    [Fact]
    public async Task UpdateConversation_AsMemberWithValidData_ReturnsNoContent()
    {
        //arrange
        string ownerToken = await RegisterAndGetToken("cvupdowner", "cvupdowner@email.com");
        string memberToken = await RegisterAndGetToken("cvupdmem", "cvupdmem@email.com");
        await RegisterAndGetToken("cvupdmem2", "cvupdmem2@email.com");
        HttpResponseMessage createResponse = await client.SendAsync(CreateRequest(HttpMethod.Post, "/conversation/createconversation", ownerToken, new CreateConversationRequest { memberUsernames = ["cvupdmem", "cvupdmem2"] }), TestContext.Current.CancellationToken);
        CreateConversationResult? conv = await createResponse.Content.ReadFromJsonAsync<CreateConversationResult>(TestContext.Current.CancellationToken);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, $"/conversation/{conv!.conversationID}", memberToken, new UpdateConversationRequest { conversationName = "Updated Name" }), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task UpdateConversation_OnDirectConversation_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, _, long conversationId) = await CreateDmConversation("cvupddmA", "cvupddmB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, $"/conversation/{conversationId}", tokenA, new UpdateConversationRequest { conversationName = "New Name" }), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateConversation_WhenNotMember_ReturnsForbidden()
    {
        //arrange
        (string ownerToken, long conversationId) = await CreateGroupConversation("cvupdnotmown", ["cvupdnotmmem", "cvupdnotmmem2"]);
        string nonMemberToken = await RegisterAndGetToken("cvupdnonem", "cvupdnonem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, $"/conversation/{conversationId}", nonMemberToken, new UpdateConversationRequest { conversationName = "Hacked Name" }), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpdateConversation_WithNonExistentConversation_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("cvupdnotf", "cvupdnotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, "/conversation/999999999", token, new UpdateConversationRequest { conversationName = "New Name" }), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateConversation_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PutAsJsonAsync("/conversation/1", new UpdateConversationRequest { conversationName = "New Name" }, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
