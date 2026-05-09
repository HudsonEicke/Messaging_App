using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Backend.Tests.Helpers;
using Messaging_App.Models;

namespace Backend.Tests.Integration;

public class ServerTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient client;

    public ServerTests(TestWebApplicationFactory factory)
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
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/server/createserver", token, new CreateServerRequest { serverName = $"{username}server" }), TestContext.Current.CancellationToken);
        CreateServerResult? result = await response.Content.ReadFromJsonAsync<CreateServerResult>(TestContext.Current.CancellationToken);
        return (token, result!.serverID);
    }

    private async Task<Guid> CreateInviteCode(string ownerToken, long serverId, CreateInviteRequest? inviteRequest = null)
    {
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/server/{serverId}/invite", ownerToken, inviteRequest ?? new CreateInviteRequest()), TestContext.Current.CancellationToken);
        CreateInviteResult? result = await response.Content.ReadFromJsonAsync<CreateInviteResult>(TestContext.Current.CancellationToken);
        return result!.inviteCode;
    }

    private async Task<(string ownerToken, string memberToken, long serverId)> CreateServerWithMember(string ownerUsername, string memberUsername)
    {
        (string ownerToken, long serverId) = await CreateServerAndGetId(ownerUsername);
        string memberToken = await RegisterAndGetToken(memberUsername, $"{memberUsername}@email.com");
        Guid inviteCode = await CreateInviteCode(ownerToken, serverId);
        await client.SendAsync(CreateRequest(HttpMethod.Post, $"/invite/{inviteCode}/join", memberToken), TestContext.Current.CancellationToken);
        return (ownerToken, memberToken, serverId);
    }

    //CREATE SERVER
    [Fact]
    public async Task CreateServer_WithValidName_ReturnsOkWithServerResult()
    {
        //arrange
        string token = await RegisterAndGetToken("svcreatsvr", "svcreatsvr@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/server/createserver", token, new CreateServerRequest { serverName = "Test Server" }), TestContext.Current.CancellationToken);
        CreateServerResult? result = await response.Content.ReadFromJsonAsync<CreateServerResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal("Test Server", result.serverName);
        Assert.True(result.serverID > 0);
    }

    [Fact]
    public async Task CreateServer_WithEmptyName_ReturnsBadRequest()
    {
        //arrange
        string token = await RegisterAndGetToken("svcreatempty", "svcreatempty@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/server/createserver", token, new CreateServerRequest { serverName = "" }), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateServer_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/server/createserver", new CreateServerRequest { serverName = "Test Server" }, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //GET SERVERS
    [Fact]
    public async Task GetServers_WhenMemberOfServer_ReturnsOkWithList()
    {
        //arrange
        (string token, _) = await CreateServerAndGetId("svgetservers");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/server/servers", token), TestContext.Current.CancellationToken);
        List<ServerResult>? result = await response.Content.ReadFromJsonAsync<List<ServerResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.NotEmpty(result);
    }

    [Fact]
    public async Task GetServers_WhenNoServers_ReturnsEmptyList()
    {
        //arrange
        string token = await RegisterAndGetToken("svgetsrvempty", "svgetsrvempty@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/server/servers", token), TestContext.Current.CancellationToken);
        List<ServerResult>? result = await response.Content.ReadFromJsonAsync<List<ServerResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetServers_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/server/servers", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //GET SERVER
    [Fact]
    public async Task GetServer_WithValidId_ReturnsOkWithServerResult()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("svgetserver");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/server/{serverId}", token), TestContext.Current.CancellationToken);
        ServerResult? result = await response.Content.ReadFromJsonAsync<ServerResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal(serverId, result.serverID);
        Assert.Equal("svgetserverserver", result.serverName);
        Assert.Equal("svgetserver", result.ownerUsername);
    }

    [Fact]
    public async Task GetServer_WithNonExistentId_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("svgetservernotf", "svgetservernotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/server/999999999", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetServer_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/server/1", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //GET SERVER MEMBERS
    [Fact]
    public async Task GetServerMembers_WhenMember_ReturnsOkWithList()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("svgetmembers");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/server/{serverId}/members", token), TestContext.Current.CancellationToken);
        List<UserResult>? result = await response.Content.ReadFromJsonAsync<List<UserResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("svgetmembers", result[0].username);
    }

    [Fact]
    public async Task GetServerMembers_WhenNotMember_ReturnsForbidden()
    {
        //arrange
        (_, long serverId) = await CreateServerAndGetId("svmembersowner");
        string nonMemberToken = await RegisterAndGetToken("svmembersnonem", "svmembersnonem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/server/{serverId}/members", nonMemberToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetServerMembers_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/server/1/members", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //UPDATE SERVER
    [Fact]
    public async Task UpdateServer_AsOwner_ReturnsOkWithUpdatedResult()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("svupdateserver");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, $"/server/{serverId}", token, new UpdateServerRequest { serverName = "Updated Name" }),TestContext.Current.CancellationToken);
        ServerResult? result = await response.Content.ReadFromJsonAsync<ServerResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal("Updated Name", result.serverName);
    }

    [Fact]
    public async Task UpdateServer_AsNonOwner_ReturnsForbidden()
    {
        //arrange
        (_, string memberToken, long serverId) = await CreateServerWithMember("svupdatenonownr", "svupdatenonmem");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, $"/server/{serverId}", memberToken, new UpdateServerRequest { serverName = "Hacked Name" }), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpdateServer_WithNonExistentId_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("svupdatenotf", "svupdatenotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, "/server/999999999", token, new UpdateServerRequest { serverName = "New Name" }), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateServer_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PutAsJsonAsync("/server/1", new UpdateServerRequest { serverName = "New Name" }, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //DELETE SERVER
    [Fact]
    public async Task DeleteServer_AsOwner_ReturnsNoContent()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("svdeleteserver");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/server/{serverId}", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteServer_AsNonOwner_ReturnsForbidden()
    {
        //arrange
        (_, string memberToken, long serverId) = await CreateServerWithMember("svdelnonownr", "svdelnonownrmem");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/server/{serverId}", memberToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DeleteServer_WithNonExistentId_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("svdeletenotf", "svdeletenotf@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, "/server/999999999", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteServer_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.DeleteAsync("/server/1", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //LEAVE SERVER
    [Fact]
    public async Task LeaveServer_AsMember_ReturnsNoContent()
    {
        //arrange
        (_, string memberToken, long serverId) = await CreateServerWithMember("svleaveowner", "svleavemember");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/server/{serverId}/leave", memberToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task LeaveServer_WhenNotMember_ReturnsNotFound()
    {
        //arrange
        (_, long serverId) = await CreateServerAndGetId("svleavenotowner");
        string nonMemberToken = await RegisterAndGetToken("svleavenotmem", "svleavenotmem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/server/{serverId}/leave", nonMemberToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task LeaveServer_AsLastMember_DeletesServerAndReturnsNoContent()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("svleavelast");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/server/{serverId}/leave", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task LeaveServer_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsync("/server/1/leave", null, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //KICK USER
    [Fact]
    public async Task KickUser_AsOwner_ReturnsNoContent()
    {
        //arrange
        (string ownerToken, _, long serverId) = await CreateServerWithMember("svkickowner", "svkickmember");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/server/{serverId}/members/svkickmember", ownerToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task KickUser_AsNonOwner_ReturnsForbidden()
    {
        //arrange
        (string ownerToken, string memberToken, long serverId) = await CreateServerWithMember("svkicknonownr", "svkicknonmem");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/server/{serverId}/members/svkicknonownr", memberToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task KickUser_WhenNotMember_ReturnsNotFound()
    {
        //arrange
        (string ownerToken, long serverId) = await CreateServerAndGetId("svkicknotmowner");
        await RegisterAndGetToken("svkicknotmem", "svkicknotmem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/server/{serverId}/members/svkicknotmem", ownerToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task KickUser_Self_ReturnsForbidden()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("svkickself");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/server/{serverId}/members/svkickself", token),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task KickUser_WithNonExistentServer_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("svkicknoserver", "svkicknoserver@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, "/server/999999999/members/someuser", token),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task KickUser_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.DeleteAsync("/server/1/members/someuser", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //CREATE INVITE
    [Fact]
    public async Task CreateInvite_AsMember_ReturnsOkWithInviteCode()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("svcreateinvite");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/server/{serverId}/invite", token, new CreateInviteRequest()),TestContext.Current.CancellationToken);
        CreateInviteResult? result = await response.Content.ReadFromJsonAsync<CreateInviteResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.NotEqual(Guid.Empty, result.inviteCode);
    }

    [Fact]
    public async Task CreateInvite_AsNonMember_ReturnsForbidden()
    {
        //arrange
        (_, long serverId) = await CreateServerAndGetId("svinviteowner");
        string nonMemberToken = await RegisterAndGetToken("svinvitenonem", "svinvitenonem@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/server/{serverId}/invite", nonMemberToken, new CreateInviteRequest()),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateInvite_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/server/1/invite",new CreateInviteRequest(), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //GET INVITES
    [Fact]
    public async Task GetInvites_AsOwner_ReturnsOkWithList()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("svgetinvites");
        await CreateInviteCode(token, serverId);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/server/{serverId}/invites", token), TestContext.Current.CancellationToken);
        List<InviteResult>? result = await response.Content.ReadFromJsonAsync<List<InviteResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("svgetinvites", result[0].createdByUsername);
    }

    [Fact]
    public async Task GetInvites_AsNonOwner_ReturnsForbidden()
    {
        //arrange
        (_, string memberToken, long serverId) = await CreateServerWithMember("svgetinvnonownr", "svgetinvnonmem");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/server/{serverId}/invites", memberToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetInvites_WithNonExistentServer_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("svgetinvnoserv", "svgetinvnoserv@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/server/999999999/invites", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetInvites_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/server/1/invites", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //DELETE INVITE
    [Fact]
    public async Task DeleteInvite_AsOwner_ReturnsNoContent()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("svdelinvite");
        Guid inviteCode = await CreateInviteCode(token, serverId);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/server/{serverId}/invite/{inviteCode}", token),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteInvite_AsNonOwner_ReturnsForbidden()
    {
        //arrange
        (string ownerToken, string memberToken, long serverId) = await CreateServerWithMember("svdelinvnonownr", "svdelinvnonmem");
        Guid inviteCode = await CreateInviteCode(ownerToken, serverId);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/server/{serverId}/invite/{inviteCode}", memberToken),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DeleteInvite_WithNonExistentServer_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("svdelinvnoserv", "svdelinvnoserv@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/server/999999999/invite/{Guid.NewGuid()}", token),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteInvite_WithNonExistentCode_ReturnsNotFound()
    {
        //arrange
        (string token, long serverId) = await CreateServerAndGetId("svdelinvnocode");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, $"/server/{serverId}/invite/{Guid.NewGuid()}", token),TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteInvite_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.DeleteAsync($"/server/1/invite/{Guid.NewGuid()}", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //JOIN SERVER
    [Fact]
    public async Task JoinServer_WithValidCode_ReturnsOkWithServerResult()
    {
        //arrange
        (string ownerToken, long serverId) = await CreateServerAndGetId("svjoinowner");
        string joinerToken = await RegisterAndGetToken("svjoinmember", "svjoinmember@email.com");
        Guid inviteCode = await CreateInviteCode(ownerToken, serverId);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/invite/{inviteCode}/join", joinerToken), TestContext.Current.CancellationToken);
        ServerResult? result = await response.Content.ReadFromJsonAsync<ServerResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal(serverId, result.serverID);
        Assert.Equal("svjoinowner", result.ownerUsername);
    }

    [Fact]
    public async Task JoinServer_WithNonExistentCode_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("svjoinnotfound", "svjoinnotfound@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/invite/{Guid.NewGuid()}/join", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task JoinServer_WhenAlreadyMember_ReturnsBadRequest()
    {
        //arrange
        (string ownerToken, long serverId) = await CreateServerAndGetId("svjoinalready");
        Guid inviteCode = await CreateInviteCode(ownerToken, serverId);

        //act — owner tries to join their own server again
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/invite/{inviteCode}/join", ownerToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task JoinServer_WithExpiredInvite_ReturnsBadRequest()
    {
        //arrange
        (string ownerToken, long serverId) = await CreateServerAndGetId("svjoinexpired");
        string joinerToken = await RegisterAndGetToken("svjoinexpmem", "svjoinexpmem@email.com");
        Guid inviteCode = await CreateInviteCode(ownerToken, serverId,new CreateInviteRequest { expiresDate = DateTimeOffset.UtcNow.AddMinutes(-1) });

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/invite/{inviteCode}/join", joinerToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task JoinServer_WithMaxUsesReached_ReturnsBadRequest()
    {
        //arrange
        (string ownerToken, long serverId) = await CreateServerAndGetId("svjoinmaxuses");
        string firstJoinerToken = await RegisterAndGetToken("svjoinmaxmem1", "svjoinmaxmem1@email.com");
        string secondJoinerToken = await RegisterAndGetToken("svjoinmaxmem2", "svjoinmaxmem2@email.com");
        Guid inviteCode = await CreateInviteCode(ownerToken, serverId, new CreateInviteRequest { maxUses = 1 });
        await client.SendAsync(CreateRequest(HttpMethod.Post, $"/invite/{inviteCode}/join", firstJoinerToken), TestContext.Current.CancellationToken);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, $"/invite/{inviteCode}/join", secondJoinerToken), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task JoinServer_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsync($"/invite/{Guid.NewGuid()}/join", null, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
