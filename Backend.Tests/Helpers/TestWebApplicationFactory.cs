using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace Backend.Tests.Helpers;

public class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((context, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:MessagingAppContext"] = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION") ?? "Host=localhost;Database=messaging_app_test;Username=postgres;Password=changeme",
                ["JwtSettings:SecretKey"] = "test-secret-key-32-chars-minimum!",
                ["JwtSettings:Issuer"] = "http://localhost",
                ["JwtSettings:Audience"] = "MessagingAppAPI",
                ["JwtSettings:AccessTokenExpirationMinutes"] = "15",
                ["JwtSettings:RefreshTokenExpirationDays"] = "7",
                ["EncryptionSettings:SecretKey"] = "test-encryption-key-32-chars-min"
            });
        });
    }
}