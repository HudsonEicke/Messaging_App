using Messaging_App.Data;
using Microsoft.EntityFrameworkCore;
using Messaging_App.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddDbContext<MessagingAppContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("MessagingAppContext"), options => options.MapEnum<ActivityStatus>("activitystatus")));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
