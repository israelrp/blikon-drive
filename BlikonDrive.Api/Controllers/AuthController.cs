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

    /// Lee access_token y refresh_token de las cookies del request (.com.blog domain).
    /// Refresca automáticamente si el access_token expiró.
    /// Usado por el bridge script de Windows desde validacel.com.blog via fetch.
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var accessToken  = Request.Cookies["access_token"];
        var refreshToken = Request.Cookies["refresh_token"];

        if (string.IsNullOrWhiteSpace(accessToken) && string.IsNullOrWhiteSpace(refreshToken))
            return Unauthorized(new { result = false, message = "Sin sesión activa" });

        if (!string.IsNullOrWhiteSpace(accessToken))
        {
            var p = await CallUsers(accessToken);
            if (p != null) return Ok(p);
        }

        // Access token expirado — refrescar con refresh_token
        if (!string.IsNullOrWhiteSpace(refreshToken))
        {
            var newToken = await RefreshToken(refreshToken);
            if (newToken != null)
            {
                var p = await CallUsers(newToken);
                if (p != null) return Ok(p);
            }
        }

        return Unauthorized(new { result = false, message = "Sesión expirada" });
    }

    private async Task<string?> RefreshToken(string refreshToken)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{ValidacelBase}/cookies/refresh_access_token");
        req.Headers.Add("Cookie", $"refresh_token={refreshToken}");
        req.Headers.Add("Origin", Origin);

        var res = await _http.SendAsync(req);
        if (!res.IsSuccessStatusCode) return null;

        if (res.Headers.TryGetValues("Set-Cookie", out var setCookies))
        {
            foreach (var c in setCookies)
                if (c.StartsWith("access_token="))
                    return c.Split(';')[0]["access_token=".Length..];
        }
        return null;
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
            UserId          = body.UserId,
            Roles           = body.Roles ?? new List<string>(),
            BlikonProfileId = body.BlikonProfileId,
            BlikonId        = body.BlikonId,
            UserTypeId      = body.UserTypeId,
            StatusId        = body.StatusId,
            RegisteredUser  = body.RegisteredUser,
            PhoneNumber     = body.PhoneNumber ?? "",
            Email           = body.Email ?? "",
            EmailIsConfirmed = body.EmailIsConfirmed,
            Username        = body.Username ?? "",
            ProfileName     = body.ProfileName ?? $"{body.FirstName} {body.LastName}".Trim(),
            Photo           = body.Photo ?? "",
            CronoCode       = body.CronoCode ?? "",
            FirstName       = body.FirstName ?? "",
            LastName        = body.LastName  ?? "",
            MotherLastName  = body.MotherLastName ?? "",
        };
    }


}

public record SessionCheckRequest(string AccessToken, string? RefreshToken);

public class ValidacelProfile
{
    public int          UserId          { get; init; }
    public List<string> Roles           { get; init; } = new();
    public int          BlikonProfileId { get; init; }
    public string       BlikonId        { get; init; } = "";
    public int          UserTypeId      { get; init; }
    public int          StatusId        { get; init; }
    public bool         RegisteredUser  { get; init; }
    public string       PhoneNumber     { get; init; } = "";
    public string       Email           { get; init; } = "";
    public bool         EmailIsConfirmed { get; init; }
    public string       Username        { get; init; } = "";
    public string       ProfileName     { get; init; } = "";
    public string       Photo           { get; init; } = "";
    public string       CronoCode       { get; init; } = "";
    public string       FirstName       { get; init; } = "";
    public string       LastName        { get; init; } = "";
    public string       MotherLastName  { get; init; } = "";
}

public class ValidacelUserResponse
{
    [System.Text.Json.Serialization.JsonPropertyName("result")]
    public bool Result { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("message")]
    public string? Message { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("user_id")]
    public int UserId { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("roles")]
    public List<string>? Roles { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("blikon_profile_id")]
    public int BlikonProfileId { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("blikon_id")]
    public string? BlikonId { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("user_type_id")]
    public int UserTypeId { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("status_id")]
    public int StatusId { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("registered_user")]
    public bool RegisteredUser { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("phone_number")]
    public string? PhoneNumber { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("email")]
    public string? Email { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("email_is_confirmed")]
    public bool EmailIsConfirmed { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("username")]
    public string? Username { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("profile_name")]
    public string? ProfileName { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("photo")]
    public string? Photo { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("crono_code")]
    public string? CronoCode { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("first_name")]
    public string? FirstName { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("last_name")]
    public string? LastName { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("mother_last_name")]
    public string? MotherLastName { get; init; }
}
