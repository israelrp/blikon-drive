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
    private const string TokenBearer ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhcGlfdXNlciIsInJvbGVzIjpbImFwaV91c2VyIl0sImV4cCI6MTgxMDE1MzM4M30.S88OSb2LDQMdtdoc2LS-eg0bnka7na76rK5hSyBVD_c";

    // Cookies del usuario que llegan en el request (access_token/refresh_token).
    // Las reenviamos a ValidaCel para que identifique al usuario correcto.
    private string? UserCookies =>
        Request.Headers.TryGetValue("Cookie", out var c) ? c.ToString() : null;

    [HttpPost("check")]
    public async Task<IActionResult> Check([FromBody] SessionCheckRequest req)
    {
        var cookies = UserCookies;
        ValidacelProfile? profile = null;
        using var reqCheckCookies = new HttpRequestMessage(HttpMethod.Post, $"{ValidacelBase}/cookies/check_cookies");
        reqCheckCookies.Headers.Add("Authorization", $"Bearer {TokenBearer}");
        if (!string.IsNullOrEmpty(cookies)) reqCheckCookies.Headers.Add("Cookie", cookies);
        var res = await _http.SendAsync(reqCheckCookies);
        if (!res.IsSuccessStatusCode) return Unauthorized(new { result = false, message = "Sesión inválida o expirada" });;
        var body = await res.Content.ReadFromJsonAsync<CheckCookiesResponse>();
        if (body?.Result == true)
        {
            if(body?.AccessTokenIsValid == true && body.RefreshTokenIsValid == true)
            {
                // Tokens válidos, devolver perfil
                profile = await CallUsers(req.AccessToken);
                if (profile == null)
                    return Unauthorized(new { result = false, message = "Sesión inválida o expirada" });
            }
            else if(body?.AccessTokenIsValid == false && body.RefreshTokenIsValid == true)
            {
                // Access token expirado, pero refresh token válido
                var newAccessToken = await RefreshToken();
                if (newAccessToken != null)
                {
                    profile = await CallUsers(newAccessToken);
                    if (profile == null)
                        return Unauthorized(new { result = false, message = "Sesión inválida o expirada" });
                }
            }
            else
            {
                // Tokens inválidos o expirados
                return Unauthorized(new { result = false, message = "Sesión expirada", access_token_is_valid = body.AccessTokenIsValid, refresh_token_is_valid = body.RefreshTokenIsValid });
            }
        }
        return Ok(profile);
    }
    
    private async Task<string?> RefreshToken()
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{ValidacelBase}/cookies/refresh_access_token");
        req.Headers.Add("Authorization", $"Bearer {TokenBearer}");
        if (!string.IsNullOrEmpty(UserCookies)) req.Headers.Add("Cookie", UserCookies);
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

    // Reemplaza (o agrega) el valor de una cookie dentro del header Cookie.
    private static string SetCookie(string? cookieHeader, string name, string? value)
    {
        var parts = (cookieHeader ?? "")
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(p => !p.StartsWith(name + "="))
            .ToList();
        if (!string.IsNullOrEmpty(value)) parts.Add($"{name}={value}");
        return string.Join("; ", parts);
    }

    private async Task<ValidacelProfile?> CallUsers(string? access_token)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{ValidacelBase}/cookies/get_user");
        req.Headers.Add("Authorization", $"Bearer {TokenBearer}");
        // Reenviar cookies del usuario; si nos dieron un access_token nuevo (tras
        // refresh) lo usamos en lugar del que venía en el request.
        var cookies = string.IsNullOrEmpty(access_token)
            ? UserCookies
            : SetCookie(UserCookies, "access_token", access_token);
        if (!string.IsNullOrEmpty(cookies)) req.Headers.Add("Cookie", cookies);
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


public class CheckCookiesResponse
{
    [System.Text.Json.Serialization.JsonPropertyName("result")]
    public bool Result { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("message")]
    public string? Message { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("access_token_is_valid")]
    public bool AccessTokenIsValid { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("access_token_remaining_secs")]
    public int AccessTokenRemainingSecs { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("refresh_token_is_valid")]
    public bool RefreshTokenIsValid { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("refresh_token_remaining_secs")]
    public int RefreshTokenRemainingSecs { get; init; }
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
