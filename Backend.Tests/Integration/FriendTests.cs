using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Backend.Tests.Helpers;
using Messaging_App.Models;

namespace Backend.Tests.Integration;

public class FriendTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient client;

    public FriendTests(TestWebApplicationFactory factory)
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

    private async Task<(string tokenA, string tokenB)> RegisterTwoUsers(string usernameA, string usernameB)
    {
        string tokenA = await RegisterAndGetToken(usernameA, $"{usernameA}@email.com");
        string tokenB = await RegisterAndGetToken(usernameB, $"{usernameB}@email.com");
        return (tokenA, tokenB);
    }

    private async Task SendFriendRequest(string senderToken, string receiverUsername)
    {
        await client.SendAsync(CreateRequest(HttpMethod.Post, $"/friend/request/{receiverUsername}", senderToken), TestContext.Current.CancellationToken);
    }

    private async Task EstablishFriendship(string senderToken, string senderUsername, string receiverToken, string receiverUsername)
    {
        await SendFriendRequest(senderToken, receiverUsername);
        await client.SendAsync(CreateRequest(HttpMethod.Post, $"/friend/accept/{senderUsername}", receiverToken), TestContext.Current.CancellationToken);
    }

    //SEND REQUEST
    [Fact]
    public async Task SendRequest_ToValidUser_ReturnsPendingStatus()
    {
        //arrange
        (string tokenA, _) = await RegisterTwoUsers("frsendA", "frsendB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/request/frsendB", tokenA), TestContext.Current.CancellationToken);
        FriendRequestResult? result = await response.Content.ReadFromJsonAsync<FriendRequestResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal(FriendStatus.pending, result.status);
    }

    [Fact]
    public async Task SendRequest_WhenOtherUserAlreadySentRequest_ReturnsFriendsStatus()
    {
        //arrange
        (string tokenA, string tokenB) = await RegisterTwoUsers("frcrossA", "frcrossB");
        await SendFriendRequest(tokenB, "frcrossA");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/request/frcrossB", tokenA), TestContext.Current.CancellationToken);
        FriendRequestResult? result = await response.Content.ReadFromJsonAsync<FriendRequestResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal(FriendStatus.friends, result.status);
    }

    [Fact]
    public async Task SendRequest_ToSelf_ReturnsBadRequest()
    {
        //arrange
        string token = await RegisterAndGetToken("frsendself", "frsendself@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/request/frsendself", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendRequest_ToNonExistentUser_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("frsendnotfound", "frsendnotfound@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/request/nonexistentuser99999", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SendRequest_WhenAlreadySent_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, _) = await RegisterTwoUsers("frduprequestA", "frduprequestB");
        await SendFriendRequest(tokenA, "frduprequestB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/request/frduprequestB", tokenA), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendRequest_WhenAlreadyFriends_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, string tokenB) = await RegisterTwoUsers("fralreadyfriendA", "fralreadyfriendB");
        await EstablishFriendship(tokenA, "fralreadyfriendA", tokenB, "fralreadyfriendB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/request/fralreadyfriendB", tokenA), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendRequest_WhenYouHaveBlockedThem_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, _) = await RegisterTwoUsers("fryoublockedA", "fryoublockedB");
        await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/block/fryoublockedB", tokenA), TestContext.Current.CancellationToken);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/request/fryoublockedB", tokenA), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendRequest_WhenTheyHaveBlockedYou_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, string tokenB) = await RegisterTwoUsers("frtheyblockedA", "frtheyblockedB");
        await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/block/frtheyblockedA", tokenB), TestContext.Current.CancellationToken);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/request/frtheyblockedB", tokenA), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendRequest_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsync("/friend/request/someuser", null, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //ACCEPT REQUEST
    [Fact]
    public async Task AcceptRequest_WithPendingRequest_ReturnsOkWithUserResult()
    {
        //arrange
        (string tokenA, string tokenB) = await RegisterTwoUsers("fracceptA", "fracceptB");
        await SendFriendRequest(tokenA, "fracceptB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/accept/fracceptA", tokenB), TestContext.Current.CancellationToken);
        UserResult? result = await response.Content.ReadFromJsonAsync<UserResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal("fracceptA", result.username);
    }

    [Fact]
    public async Task AcceptRequest_WithNoPendingRequest_ReturnsNotFound()
    {
        //arrange
        (string tokenA, string tokenB) = await RegisterTwoUsers("fracceptnopenA", "fracceptnopenB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/accept/fracceptnopenA", tokenB), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AcceptRequest_ToNonExistentUser_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("fracceptnonexist", "fracceptnonexist@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/accept/nonexistentuser99999", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AcceptRequest_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsync("/friend/accept/someuser", null, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //DECLINE REQUEST
    [Fact]
    public async Task DeclineRequest_WithPendingRequest_ReturnsNoContent()
    {
        //arrange
        (string tokenA, string tokenB) = await RegisterTwoUsers("frdeclineA", "frdeclineB");
        await SendFriendRequest(tokenA, "frdeclineB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/decline/frdeclineA", tokenB), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeclineRequest_WithNoPendingRequest_ReturnsNotFound()
    {
        //arrange
        (string tokenA, string tokenB) = await RegisterTwoUsers("frdecinenorequestA", "frdecinenorequestB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/decline/frdecinenorequestA", tokenB), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeclineRequest_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsync("/friend/decline/someuser", null, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //UNFRIEND
    [Fact]
    public async Task UnfriendUser_WhenFriends_ReturnsNoContent()
    {
        //arrange
        (string tokenA, string tokenB) = await RegisterTwoUsers("frunfriendA", "frunfriendB");
        await EstablishFriendship(tokenA, "frunfriendA", tokenB, "frunfriendB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, "/friend/frunfriendB", tokenA), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task UnfriendUser_WhenNotFriends_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, _) = await RegisterTwoUsers("frnotfriendsA", "frnotfriendsB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, "/friend/frnotfriendsB", tokenA), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UnfriendUser_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.DeleteAsync("/friend/someuser", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //BLOCK USER
    [Fact]
    public async Task BlockUser_WithValidUser_ReturnsNoContent()
    {
        //arrange
        (string tokenA, _) = await RegisterTwoUsers("frblockA", "frblockB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/block/frblockB", tokenA), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task BlockUser_WhenAlreadyBlocked_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, _) = await RegisterTwoUsers("fralrblockA", "fralrblockB");
        await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/block/fralrblockB", tokenA), TestContext.Current.CancellationToken);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/block/fralrblockB", tokenA), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task BlockUser_ToSelf_ReturnsBadRequest()
    {
        //arrange
        string token = await RegisterAndGetToken("frblockself", "frblockself@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/block/frblockself", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task BlockUser_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.PostAsync("/friend/block/someuser", null, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //UNBLOCK USER
    [Fact]
    public async Task UnblockUser_WhenBlocked_ReturnsNoContent()
    {
        //arrange
        (string tokenA, _) = await RegisterTwoUsers("frunblockA", "frunblockB");
        await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/block/frunblockB", tokenA), TestContext.Current.CancellationToken);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, "/friend/block/frunblockB", tokenA), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task UnblockUser_WhenNotBlocked_ReturnsBadRequest()
    {
        //arrange
        (string tokenA, _) = await RegisterTwoUsers("frnotblockedA", "frnotblockedB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Delete, "/friend/block/frnotblockedB", tokenA), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UnblockUser_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.DeleteAsync("/friend/block/someuser", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //GET FRIENDS
    [Fact]
    public async Task GetFriends_WhenFriendsExist_ReturnsOkWithList()
    {
        //arrange
        (string tokenA, string tokenB) = await RegisterTwoUsers("frgetfriendsA", "frgetfriendsB");
        await EstablishFriendship(tokenA, "frgetfriendsA", tokenB, "frgetfriendsB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/friend", tokenA), TestContext.Current.CancellationToken);
        List<UserResult>? result = await response.Content.ReadFromJsonAsync<List<UserResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("frgetfriendsB", result[0].username);
    }

    [Fact]
    public async Task GetFriends_WhenNoFriends_ReturnsEmptyList()
    {
        //arrange
        string token = await RegisterAndGetToken("frgetfriendsempty", "frgetfriendsempty@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/friend", token), TestContext.Current.CancellationToken);
        List<UserResult>? result = await response.Content.ReadFromJsonAsync<List<UserResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetFriends_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/friend", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //GET PENDING FRIENDS
    [Fact]
    public async Task GetPendingFriends_WithPendingRequest_ReturnsOkWithList()
    {
        //arrange
        (string tokenA, string tokenB) = await RegisterTwoUsers("frpendingA", "frpendingB");
        await SendFriendRequest(tokenA, "frpendingB");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/friend/pending", tokenB), TestContext.Current.CancellationToken);
        List<UserResult>? result = await response.Content.ReadFromJsonAsync<List<UserResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("frpendingA", result[0].username);
    }

    [Fact]
    public async Task GetPendingFriends_WhenNoPending_ReturnsEmptyList()
    {
        //arrange
        string token = await RegisterAndGetToken("frpendingempty", "frpendingempty@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/friend/pending", token), TestContext.Current.CancellationToken);
        List<UserResult>? result = await response.Content.ReadFromJsonAsync<List<UserResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetPendingFriends_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/friend/pending", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //GET BLOCKED USERS
    [Fact]
    public async Task GetBlockedUsers_WhenBlockedUsersExist_ReturnsOkWithList()
    {
        //arrange
        (string tokenA, _) = await RegisterTwoUsers("frgetblockedA", "frgetblockedB");
        await client.SendAsync(CreateRequest(HttpMethod.Post, "/friend/block/frgetblockedB", tokenA), TestContext.Current.CancellationToken);

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/friend/blocked", tokenA), TestContext.Current.CancellationToken);
        List<UserResult>? result = await response.Content.ReadFromJsonAsync<List<UserResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("frgetblockedB", result[0].username);
    }

    [Fact]
    public async Task GetBlockedUsers_WhenNoneBlocked_ReturnsEmptyList()
    {
        //arrange
        string token = await RegisterAndGetToken("frgetblockedempty", "frgetblockedempty@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/friend/blocked", token), TestContext.Current.CancellationToken);
        List<UserResult>? result = await response.Content.ReadFromJsonAsync<List<UserResult>>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetBlockedUsers_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/friend/blocked", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
