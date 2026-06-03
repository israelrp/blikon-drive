using BlikonDrive.Api.Services;
using BlikonDrive.Core.Interfaces;
using BlikonDrive.Infrastructure.Azure;
using BlikonDrive.Infrastructure.Jobs;
using BlikonDrive.Infrastructure.Persistence;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connectionString = builder.Configuration.GetConnectionString("Postgres")!;

var dataSource = new NpgsqlDataSourceBuilder(connectionString)
    .EnableDynamicJson()
    .Build();

builder.Services.AddDbContext<DriveDbContext>(opt =>
    opt.UseNpgsql(dataSource));

builder.Services.AddHangfire(cfg => cfg
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(opt => opt.UseNpgsqlConnection(connectionString)));

builder.Services.AddHangfireServer();

builder.Services.AddScoped<IBlobStorageService, BlobStorageService>();
builder.Services.AddScoped<ExtractExifJob>();
builder.Services.AddScoped<IndexPdfJob>();
builder.Services.AddSingleton<FileEventService>();

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>();

builder.Services.AddCors(opt => opt.AddDefaultPolicy(p =>
{
    if (allowedOrigins is { Length: > 0 })
        p.WithOrigins(allowedOrigins).AllowAnyMethod().AllowAnyHeader();
    else
        p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader(); // dev
}));

var app = builder.Build();

if (app.Environment.IsDevelopment() || builder.Configuration["EnableSwagger"] == "true")
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthorization();
app.MapControllers();
app.UseHangfireDashboard("/hangfire");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<DriveDbContext>();
    db.Database.Migrate();
}

app.Run();
