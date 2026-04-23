using System.Net;
using System.Net.Http.Json;
using Backend.Tests.Helpers;
using Messaging_App.Models;

namespace Backend.Tests.Integration;

public class AuthTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient client;

    public AuthTests(TestWebApplicationFactory factory)
    {
        client = factory.CreateClient();
    }

    //REGISTER
    [Fact]
    public async Task Register_WithValidRequest_ReturnsOkWithTokens()
    {
        //arrange
        RegisterRequest request = new RegisterRequest
        {
            username = "registertest",
            email = "registertest@email.com",
            password = "Test123!"
        };

        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/register", request, TestContext.Current.CancellationToken);
        AuthResult? result = await response.Content.ReadFromJsonAsync<AuthResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.True(result.success);
        Assert.NotEmpty(result.accessToken);
        Assert.NotEmpty(result.refreshToken);
    }

    [Fact]
    public async Task Register_WithDuplicateUsername_ReturnsConflict()
    {
        //arrange
        RegisterRequest request = new RegisterRequest
        {
            username = "duplicateuser",
            email = "duplicate@email.com",
            password = "Test123!"
        };
        await client.PostAsJsonAsync("/auth/register", request, TestContext.Current.CancellationToken);

        RegisterRequest duplicate = new RegisterRequest
        {
            username = "duplicateuser",
            email = "different@email.com",
            password = "Test123!"
        };

        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/register", duplicate, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_ReturnsConflict()
    {
        //arrange
        RegisterRequest request = new RegisterRequest
        {
            username = "uniqueuser",
            email = "sharedemail@email.com",
            password = "Test123!"
        };
        await client.PostAsJsonAsync("/auth/register", request, TestContext.Current.CancellationToken);

        RegisterRequest duplicate = new RegisterRequest
        {
            username = "differentuser",
            email = "sharedemail@email.com",
            password = "Test123!"
        };

        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/register", duplicate, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithEmptyFields_ReturnsBadRequest()
    {
        //arrange
        RegisterRequest request = new RegisterRequest
        {
            username = "",
            email = "",
            password = ""
        };

        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/register", request, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    //LOGIN
    [Fact]
    public async Task Login_WithValidCredentials_ReturnsOkWithTokens()
    {
        //arrange
        RegisterRequest registerRequest = new RegisterRequest
        {
            username = "logintest",
            email = "logintest@email.com",
            password = "Test123!"
        };
        await client.PostAsJsonAsync("/auth/register", registerRequest, TestContext.Current.CancellationToken);

        LoginRequest loginRequest = new LoginRequest
        {
            username = "logintest",
            password = "Test123!"
        };

        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/login", loginRequest, TestContext.Current.CancellationToken);
        AuthResult? result = await response.Content.ReadFromJsonAsync<AuthResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.True(result.success);
        Assert.NotEmpty(result.accessToken);
        Assert.NotEmpty(result.refreshToken);
    }

    [Fact]
    public async Task Login_WithInvalidPassword_ReturnsUnauthorized()
    {
        //arrange
        RegisterRequest registerRequest = new RegisterRequest
        {
            username = "loginwrongpass",
            email = "loginwrongpass@email.com",
            password = "Test123!"
        };
        await client.PostAsJsonAsync("/auth/register", registerRequest, TestContext.Current.CancellationToken);

        LoginRequest loginRequest = new LoginRequest
        {
            username = "loginwrongpass",
            password = "WrongPassword!"
        };

        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/login", loginRequest, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithNonExistentUser_ReturnsUnauthorized()
    {
        //arrange
        LoginRequest loginRequest = new LoginRequest
        {
            username = "nonexistentuser",
            password = "Test123!"
        };

        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/login", loginRequest, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //REFRESH
    [Fact]
    public async Task Refresh_WithValidToken_ReturnsNewTokens()
    {
        //arrange
        RegisterRequest registerRequest = new RegisterRequest
        {
            username = "refreshtest",
            email = "refreshtest@email.com",
            password = "Test123!"
        };
        HttpResponseMessage registerResponse = await client.PostAsJsonAsync("/auth/register", registerRequest, TestContext.Current.CancellationToken);
        AuthResult? registerResult = await registerResponse.Content.ReadFromJsonAsync<AuthResult>(TestContext.Current.CancellationToken);

        RefreshRequest refreshRequest = new RefreshRequest
        {
            accessToken = registerResult!.accessToken,
            refreshToken = registerResult.refreshToken
        };

        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/refresh", refreshRequest, TestContext.Current.CancellationToken);
        AuthResult? result = await response.Content.ReadFromJsonAsync<AuthResult>(TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(result);
        Assert.NotEmpty(result.accessToken);
        Assert.NotEmpty(result.refreshToken);
        Assert.NotEqual(registerResult.refreshToken, result.refreshToken);
    }

    [Fact]
    public async Task Refresh_WithInvalidToken_ReturnsUnauthorized()
    {
        //arrange
        RefreshRequest refreshRequest = new RefreshRequest
        {
            accessToken = "invalid",
            refreshToken = "invalid"
        };

        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/refresh", refreshRequest, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    //LOGOUT
    [Fact]
    public async Task Logout_WithValidToken_ReturnsOk()
    {
        //arrange
        RegisterRequest registerRequest = new RegisterRequest
        {
            username = "logouttest",
            email = "logouttest@email.com",
            password = "Test123!"
        };
        HttpResponseMessage registerResponse = await client.PostAsJsonAsync("/auth/register", registerRequest, TestContext.Current.CancellationToken);
        AuthResult? registerResult = await registerResponse.Content.ReadFromJsonAsync<AuthResult>(TestContext.Current.CancellationToken);

        LogoutRequest logoutRequest = new LogoutRequest
        {
            refreshToken = registerResult!.refreshToken
        };

        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/logout", logoutRequest, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Logout_ThenRefresh_ReturnsUnauthorized()
    {
        //arrange
        RegisterRequest registerRequest = new RegisterRequest
        {
            username = "logoutrefreshtest",
            email = "logoutrefreshtest@email.com",
            password = "Test123!"
        };
        HttpResponseMessage registerResponse = await client.PostAsJsonAsync("/auth/register", registerRequest, TestContext.Current.CancellationToken);
        AuthResult? registerResult = await registerResponse.Content.ReadFromJsonAsync<AuthResult>(TestContext.Current.CancellationToken);

        await client.PostAsJsonAsync("/auth/logout", new LogoutRequest { refreshToken = registerResult!.refreshToken }, TestContext.Current.CancellationToken);

        RefreshRequest refreshRequest = new RefreshRequest
        {
            accessToken = registerResult.accessToken,
            refreshToken = registerResult.refreshToken
        };

        //act
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/refresh", refreshRequest, TestContext.Current.CancellationToken);

        //assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
