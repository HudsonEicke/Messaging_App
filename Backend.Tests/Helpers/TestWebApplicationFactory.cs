using System.Text;
using Messaging_App.Configuration;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Backend.Tests.Helpers;

public class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    private const string TestJwtKey = "test-secret-key-32-chars-minimum!";
    private const string TestJwtIssuer = "http://localhost";
    private const string TestJwtAudience = "MessagingAppAPI";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((context, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:SecretKey"] = TestJwtKey,
                ["JwtSettings:Issuer"] = TestJwtIssuer,
                ["JwtSettings:Audience"] = TestJwtAudience,
     
                ["JwtSettings:AccessTokenExpirationMinutes"] = "15",
                ["JwtSettings:RefreshTokenExpirationDays"] = "7",
                ["EncryptionSettings:SecretKey"] = "test-encryption-key-32-chars-min"
            });

            string localSettings = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "appsettings.Development.json"));
            config.AddJsonFile(localSettings, optional: true);
        });

        builder.ConfigureServices(services =>
        {
            services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
                .PostConfigure<IOptions<JwtSettings>>((options, jwtSettings) =>
                {
                    byte[] keyBytes = Encoding.UTF8.GetBytes(jwtSettings.Value.SecretKey);
                    options.TokenValidationParameters.IssuerSigningKey = new SymmetricSecurityKey(keyBytes);
                    options.TokenValidationParameters.ValidIssuer = jwtSettings.Value.Issuer;
                    options.TokenValidationParameters.ValidAudience = jwtSettings.Value.Audience;
                });
        });
    }
}