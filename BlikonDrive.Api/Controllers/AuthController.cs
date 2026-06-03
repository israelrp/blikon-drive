using Microsoft.AspNetCore.Mvc;

namespace BlikonDrive.Api.Controllers;

/// <summary>
/// Proxy para validar sesión ValidaCel desde el Sync Desk.
/// El Sync Desk extrae las cookies del WKWebView (acceso nativo ObjC) y las envía aquí.
/// Esta API llama a ValidaCel server-side — sin CORS ni restricciones SameSite.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private static readonly HttpClient _http = new(new HttpClientHandler
    {
        UseCookies = false   // manejamos Cookie header manualmente
    })
    {
        Timeout = TimeSpan.FromSeconds(10)
    };

    private const string ValidacelBase = "https://api-authentication-v3.com.blog/api/v3";
    private const string Origin        = "https://validacel.com.blog";

    [HttpPost("check")]
    public async Task<IActionResult> Check([FromBody] SessionCheckRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.AccessToken))
            return BadRequest(new { result = false, message = "access_token requerido" });
        

        var profile = await CallUsers(req.AccessToken);

        
        if (profile == null)
            return Unauthorized(new { result = false, message = "Sesión inválida o expirada" });

        return Ok(profile);
    }

    private async Task<ValidacelProfile?> CallUsers(string access_token)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{ValidacelBase}/users");
        req.Headers.Add("Authorization", "Bearer " + access_token);        

        var res = await _http.SendAsync(req);
        if (!res.IsSuccessStatusCode) return null;

        var body = await res.Content.ReadFromJsonAsync<ValidacelUserResponse>();
        if (body?.Result != true || string.IsNullOrEmpty(body.BlikonId)) return null;

        return new ValidacelProfile
        {
            BlikonId    = body.BlikonId,
            ProfileName = body.ProfileName ?? $"{body.FirstName} {body.LastName}".Trim(),
            Email       = body.Email ?? "",
            Photo       = body.Photo ?? "",
            FirstName   = body.FirstName ?? "",
            LastName    = body.LastName  ?? "",
        };
    }

    
}

public record SessionCheckRequest(string AccessToken, string? RefreshToken);

public class ValidacelProfile
{
    public string BlikonId    { get; init; } = "";
    public string ProfileName { get; init; } = "";
    public string Email       { get; init; } = "";
    public string Photo       { get; init; } = "";
    public string FirstName   { get; init; } = "";
    public string LastName    { get; init; } = "";
}

public class ValidacelUserResponse
{
    [System.Text.Json.Serialization.JsonPropertyName("result")]
    public bool Result { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("blikon_id")]
    public string? BlikonId { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("profile_name")]
    public string? ProfileName { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("email")]
    public string? Email { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("photo")]
    public string? Photo { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("first_name")]
    public string? FirstName { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("last_name")]
    public string? LastName { get; init; }
}
