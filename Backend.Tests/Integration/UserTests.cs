using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Backend.Tests.Helpers;
using Messaging_App.Data;
using Messaging_App.Models;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Tests.Integration;

public class UserTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient client;
    private readonly TestWebApplicationFactory factory;

    public UserTests(TestWebApplicationFactory factory)
    {
        this.factory = factory;
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

    //GET ME
    [Fact]
    public async Task GetMe_WithValidToken_ReturnsOkWithUserDetails()
    {
        //arrange
        string token = await RegisterAndGetToken("getmetest", "getmetest@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/user/me", token), TestContext.Current.CancellationToken);
        UserDetailedResult? result = await response.Content.ReadFromJsonAsync<UserDetailedResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal("getmetest", result.username);
        Assert.Equal("getmetest@email.com", result.email);
    }

    [Fact]
    public async Task GetMe_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/user/me", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //GET USER BY ID
    [Fact]
    public async Task GetUserById_WithValidId_ReturnsOkWithPublicProfile()
    {
        //arrange
        string token = await RegisterAndGetToken("getbyidtest", "getbyidtest@email.com");

        using IServiceScope scope = factory.Services.CreateScope();
        MessagingAppContext db = scope.ServiceProvider.GetRequiredService<MessagingAppContext>();
        User user = db.Users.First(u => u.username == "getbyidtest");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, $"/user/{user.id}", token), TestContext.Current.CancellationToken);
        UserResult? result = await response.Content.ReadFromJsonAsync<UserResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal("getbyidtest", result.username);
    }

    [Fact]
    public async Task GetUserById_WithNonExistentId_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("getbyidnotfound", "getbyidnotfound@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/user/999999999", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetUserById_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/user/999999999", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //GET USER BY USERNAME
    [Fact]
    public async Task GetUserByUsername_WithValidUsername_ReturnsOkWithPublicProfile()
    {
        //arrange
        string token = await RegisterAndGetToken("getbyusernametest", "getbyusernametest@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/user/username/getbyusernametest", token), TestContext.Current.CancellationToken);
        UserResult? result = await response.Content.ReadFromJsonAsync<UserResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal("getbyusernametest", result.username);
    }

    [Fact]
    public async Task GetUserByUsername_WithNonExistentUsername_ReturnsNotFound()
    {
        //arrange
        string token = await RegisterAndGetToken("getbyusernamenotfound", "getbyusrnamenotfound@email.com");

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Get, "/user/username/nonexistentuser99999", token), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetUserByUsername_WithoutToken_ReturnsUnauthorized()
    {
        //act
        HttpResponseMessage response = await client.GetAsync("/user/username/someuser", TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //UPDATE ME
    [Fact]
    public async Task UpdateMe_WithDisplayName_ReturnsOkWithUpdatedDisplayName()
    {
        //arrange
        string token = await RegisterAndGetToken("updatemedisp", "updatemedisp@email.com");
        UpdateMeRequest updateRequest = new UpdateMeRequest { displayName = "New Display Name" };

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, "/user/me", token, updateRequest), TestContext.Current.CancellationToken);
        UserResult? result = await response.Content.ReadFromJsonAsync<UserResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal("New Display Name", result.displayName);
    }

    [Fact]
    public async Task UpdateMe_WithProfileImageUrl_ReturnsOkWithUpdatedUrl()
    {
        //arrange
        string token = await RegisterAndGetToken("updatemeimage", "updatemeimage@email.com");
        UpdateMeRequest updateRequest = new UpdateMeRequest { profileImageUrl = "https://example.com/image.png" };

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, "/user/me", token, updateRequest), TestContext.Current.CancellationToken);
        UserResult? result = await response.Content.ReadFromJsonAsync<UserResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.Equal("https://example.com/image.png", result.profileImageUrl);
    }

    [Fact]
    public async Task UpdateMe_WithNoFields_ReturnsBadRequest()
    {
        //arrange
        string token = await RegisterAndGetToken("updatemeempty", "updatemeempty@email.com");
        UpdateMeRequest updateRequest = new UpdateMeRequest();

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, "/user/me", token, updateRequest), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateMe_WithoutToken_ReturnsUnauthorized()
    {
        //arrange
        UpdateMeRequest updateRequest = new UpdateMeRequest { displayName = "New Name" };

        //act
        HttpResponseMessage response = await client.PutAsJsonAsync("/user/me", updateRequest, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //UPDATE PASSWORD
    [Fact]
    public async Task UpdatePassword_WithValidCurrentPassword_ReturnsOk()
    {
        //arrange
        string token = await RegisterAndGetToken("updatepasstest", "updatepasstest@email.com");
        UpdatePasswordRequest updateRequest = new UpdatePasswordRequest
        {
            currentPassword = "Test123!",
            newPassword = "NewTest456!"
        };

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, "/user/me/password", token, updateRequest), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePassword_ThenLoginWithNewPassword_ReturnsOk()
    {
        //arrange
        string token = await RegisterAndGetToken("updatepassnewlogin", "updatepassnewlogin@email.com");
        UpdatePasswordRequest updateRequest = new UpdatePasswordRequest
        {
            currentPassword = "Test123!",
            newPassword = "NewTest456!"
        };
        await client.SendAsync(CreateRequest(HttpMethod.Put, "/user/me/password", token, updateRequest), TestContext.Current.CancellationToken);

        LoginRequest loginRequest = new LoginRequest
        {
            username = "updatepassnewlogin",
            password = "NewTest456!"
        };

        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/login", loginRequest, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePassword_WithWrongCurrentPassword_ReturnsUnauthorized()
    {
        //arrange
        string token = await RegisterAndGetToken("updatepasswrong", "updatepasswrong@email.com");
        UpdatePasswordRequest updateRequest = new UpdatePasswordRequest
        {
            currentPassword = "WrongPassword!",
            newPassword = "NewTest456!"
        };

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, "/user/me/password", token, updateRequest), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePassword_WithSamePasswords_ReturnsBadRequest()
    {
        //arrange
        string token = await RegisterAndGetToken("updatepasssame", "updatepasssame@email.com");
        UpdatePasswordRequest updateRequest = new UpdatePasswordRequest
        {
            currentPassword = "Test123!",
            newPassword = "Test123!"
        };

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, "/user/me/password", token, updateRequest), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePassword_WithEmptyFields_ReturnsBadRequest()
    {
        //arrange
        string token = await RegisterAndGetToken("updatepassempty", "updatepassempty@email.com");
        UpdatePasswordRequest updateRequest = new UpdatePasswordRequest
        {
            currentPassword = "",
            newPassword = ""
        };

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, "/user/me/password", token, updateRequest), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePassword_WithoutToken_ReturnsUnauthorized()
    {
        //arrange
        UpdatePasswordRequest updateRequest = new UpdatePasswordRequest
        {
            currentPassword = "Test123!",
            newPassword = "NewTest456!"
        };

        //act
        HttpResponseMessage response = await client.PutAsJsonAsync("/user/me/password", updateRequest, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //UPDATE STATUS
    [Fact]
    public async Task UpdateStatus_WithValidStatus_ReturnsOk()
    {
        //arrange
        string token = await RegisterAndGetToken("updatestatustest", "updatestatustest@email.com");
        UpdateStatusRequest statusRequest = new UpdateStatusRequest { newStatus = ActivityStatus.away };

        //act
        HttpResponseMessage response = await client.SendAsync(CreateRequest(HttpMethod.Put, "/user/me/status", token, statusRequest), TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UpdateStatus_WithoutToken_ReturnsUnauthorized()
    {
        //arrange
        UpdateStatusRequest statusRequest = new UpdateStatusRequest { newStatus = ActivityStatus.away };

        //act
        HttpResponseMessage response = await client.PutAsJsonAsync("/user/me/status", statusRequest, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
