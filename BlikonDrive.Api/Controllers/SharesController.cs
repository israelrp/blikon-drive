using BlikonDrive.Core.Entities;
using BlikonDrive.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlikonDrive.Api.Controllers;

[ApiController]
[Route("api/shares")]
public class SharesController(DriveDbContext db) : ControllerBase
{
    private string BlikonId =>
        Request.Headers.TryGetValue("X-Blikon-Id", out var v) && !string.IsNullOrWhiteSpace(v)
            ? v.ToString()
            : "dev-blikon-001";

    // Teléfono del usuario autenticado (para "compartidos conmigo")
    private string Phone =>
        Request.Headers.TryGetValue("X-Phone-Number", out var v) && !string.IsNullOrWhiteSpace(v)
            ? NormalizePhone(v.ToString())
            : "";

    /// Deja solo dígitos. ValidaCel entrega código de país + 10 dígitos.
    private static string NormalizePhone(string raw) =>
        new string(raw.Where(char.IsDigit).ToArray());

    private static readonly string[] ValidPermissions = ["viewer", "editor"];

    /// Comparte un folder con un teléfono. Solo el dueño puede compartir.
    [HttpPost]
    public async Task<IActionResult> Share([FromBody] ShareRequest req)
    {
        var phone = NormalizePhone(req.PhoneNumber ?? "");
        if (phone.Length < 10) return BadRequest(new { message = "Teléfono inválido (mínimo 10 dígitos)" });

        var permission = (req.Permission ?? "viewer").ToLower();
        if (!ValidPermissions.Contains(permission)) permission = "viewer";

        var folder = await db.Folders.FirstOrDefaultAsync(f => f.Id == req.FolderId && f.BlikonId == BlikonId);
        if (folder is null) return NotFound(new { message = "Folder no encontrado o no eres el dueño" });

        // Upsert: si ya existe el share, actualiza el permiso
        var existing = await db.FolderShares
            .FirstOrDefaultAsync(s => s.FolderId == req.FolderId && s.PhoneNumber == phone);
        if (existing is not null)
        {
            existing.Permission = permission;
        }
        else
        {
            db.FolderShares.Add(new FolderShare
            {
                Id            = Guid.NewGuid(),
                FolderId      = req.FolderId,
                OwnerBlikonId = BlikonId,
                PhoneNumber   = phone,
                Permission    = permission,
            });
        }
        await db.SaveChangesAsync();
        return Ok(new { folderId = req.FolderId, phoneNumber = phone, permission });
    }

    /// Lista los shares de un folder (con quién está compartido). Solo el dueño.
    [HttpGet]
    public async Task<IActionResult> ListForFolder([FromQuery] string folderId)
    {
        var owns = await db.Folders.AnyAsync(f => f.Id == folderId && f.BlikonId == BlikonId);
        if (!owns) return NotFound();

        var shares = await db.FolderShares
            .Where(s => s.FolderId == folderId)
            .OrderBy(s => s.CreatedAt)
            .Select(s => new { s.Id, s.PhoneNumber, s.Permission, s.CreatedAt })
            .ToListAsync();

        return Ok(shares);
    }

    /// Quita un share. Solo el dueño del folder.
    [HttpDelete("{id}")]
    public async Task<IActionResult> Unshare(Guid id)
    {
        var share = await db.FolderShares.FirstOrDefaultAsync(s => s.Id == id && s.OwnerBlikonId == BlikonId);
        if (share is null) return NotFound();
        db.FolderShares.Remove(share);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// Folders compartidos CONMIGO (por mi teléfono). Devuelve info del folder + permiso.
    [HttpGet("with-me")]
    public async Task<IActionResult> SharedWithMe()
    {
        var phone = Phone;
        if (phone.Length < 10) return Ok(Array.Empty<object>());

        var shares = await db.FolderShares
            .Where(s => s.PhoneNumber == phone)
            .Join(db.Folders,
                s => s.FolderId,
                f => f.Id,
                (s, f) => new
                {
                    f.Id,
                    f.Name,
                    f.ParentId,
                    f.CreatedAt,
                    OwnerBlikonId = s.OwnerBlikonId,
                    Permission    = s.Permission,
                    ShareId       = s.Id,
                    ChildCount    = db.Folders.Count(c => c.ParentId == f.Id),
                    FileCount     = db.Files.Count(x => x.CoreFolderId == f.Id && x.DeletedAt == null),
                })
            .OrderBy(x => x.Name)
            .ToListAsync();

        return Ok(shares);
    }
}

public record ShareRequest(string FolderId, string? PhoneNumber, string? Permission);
