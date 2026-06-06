using BlikonDrive.Core.Entities;
using BlikonDrive.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlikonDrive.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FoldersController(DriveDbContext db) : ControllerBase
{
    private string BlikonId =>
        Request.Headers.TryGetValue("X-Blikon-Id", out var v) && !string.IsNullOrWhiteSpace(v)
            ? v.ToString()
            : "dev-blikon-001";

    private string Phone =>
        Request.Headers.TryGetValue("X-Phone-Number", out var v) && !string.IsNullOrWhiteSpace(v)
            ? new string(v.ToString().Where(char.IsDigit).ToArray())
            : "";

    private record Access(string Owner, bool CanWrite);

    /// Acceso del caller a un folder: dueño real + si puede escribir.
    /// - Dueño → write. Editor compartido → write. Viewer → read-only.
    /// - Sin acceso → null. Folder inexistente → (caller, write) (lo está creando).
    private async Task<Access?> ResolveAccessAsync(string folderId)
    {
        var folder = await db.Folders.FirstOrDefaultAsync(f => f.Id == folderId);
        if (folder is null) return new Access(BlikonId, true);
        if (folder.BlikonId == BlikonId) return new Access(BlikonId, true);

        if (Phone.Length >= 10)
        {
            var shares = await db.FolderShares
                .Where(s => s.PhoneNumber == Phone)
                .Select(s => new { s.FolderId, s.Permission })
                .ToListAsync();
            var matches = shares
                .Where(s => folderId == s.FolderId || folderId.StartsWith(s.FolderId + "/"))
                .ToList();
            if (matches.Count > 0)
                return new Access(folder.BlikonId, matches.Any(s => s.Permission == "editor"));
        }
        return null;
    }

    private async Task<string?> ResolveOwnerAsync(string folderId)
        => (await ResolveAccessAsync(folderId))?.Owner;

    // Solo minúsculas y números. SIN guiones: el guión es el separador del
    // sistema de direcciones (drive-{crono}-folder-folder.com.blog).
    private static string SlugSegment(string s) =>
        new string(s.ToLowerInvariant().Where(c => c is >= 'a' and <= 'z' or >= '0' and <= '9').ToArray());

    [HttpPost("ensure")]
    public async Task<IActionResult> Ensure([FromBody] EnsureFolderRequest req)
    {
        var segments = req.Path
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(SlugSegment)
            .Where(s => s.Length > 0)
            .ToList();

        if (segments.Count == 0) return BadRequest("El path no puede estar vacío.");

        // El parentId también debe ir ya normalizado (sus segmentos sin guiones).
        string? parentId = string.IsNullOrEmpty(req.ParentId)
            ? null
            : string.Join("/", req.ParentId.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(SlugSegment).Where(s => s.Length > 0));
        if (parentId == "") parentId = null;
        // El dueño de los folders nuevos: por defecto el caller (folders raíz propios).
        // Si se crea bajo un folder existente, se hereda el dueño de ese folder.
        var ownerBlikonId = BlikonId;
        DriveFolder? leaf = null;

        for (int i = 0; i < segments.Count; i++)
        {
            var id = parentId is null ? segments[i] : $"{parentId}/{segments[i]}";

            var folder = await db.Folders.FindAsync(id);
            if (folder is null)
            {
                // Crear nuevo. Si hay padre, requiere permiso de escritura y hereda su dueño.
                if (parentId is not null)
                {
                    var access = await ResolveAccessAsync(parentId);
                    if (access is null || !access.CanWrite)
                        return StatusCode(403, new { message = "Sin permiso para crear carpetas aquí" });
                    ownerBlikonId = access.Owner;
                }

                folder = new DriveFolder
                {
                    Id       = id,
                    BlikonId = ownerBlikonId,
                    ParentId = parentId,
                    Name     = segments[i],
                };
                db.Folders.Add(folder);
                await db.SaveChangesAsync();
            }
            else
            {
                // Ya existe → heredamos su dueño para los hijos que sigan.
                ownerBlikonId = folder.BlikonId;
            }

            parentId = id;
            leaf     = folder;
        }

        return Ok(leaf);
    }

    [HttpGet]
    public async Task<IActionResult> GetRoots()
    {
        var blikonId = BlikonId;
        var roots = await db.Folders
            .Where(f => f.BlikonId == blikonId && f.ParentId == null)
            .OrderBy(f => f.Name)
            .Select(f => new FolderDto(
                f.Id, f.Name, f.ParentId, f.CreatedAt,
                db.Folders.Count(c => c.ParentId == f.Id),
                db.Files.Count(x => x.CoreFolderId == f.Id)))
            .ToListAsync();

        return Ok(roots);
    }

    [HttpGet("children")]
    public async Task<IActionResult> GetChildren([FromQuery] string? parentId)
    {
        // Sin parentId → raíces propias del usuario.
        // Con parentId → hijos del folder, resolviendo acceso (propio o compartido).
        string owner;
        if (string.IsNullOrEmpty(parentId))
        {
            owner = BlikonId;
        }
        else
        {
            var resolved = await ResolveOwnerAsync(parentId);
            if (resolved is null) return Ok(Array.Empty<FolderDto>());
            owner = resolved;
        }

        var children = await db.Folders
            .Where(f => f.BlikonId == owner && f.ParentId == parentId)
            .OrderBy(f => f.Name)
            .Select(f => new FolderDto(
                f.Id, f.Name, f.ParentId, f.CreatedAt,
                db.Folders.Count(c => c.ParentId == f.Id),
                db.Files.Count(x => x.CoreFolderId == f.Id && x.DeletedAt == null)))
            .ToListAsync();

        return Ok(children);
    }

    [HttpGet("breadcrumb")]
    public async Task<IActionResult> GetBreadcrumb([FromQuery] string id)
    {
        var crumbs  = new List<object>();
        var current = await db.Folders.FindAsync(id);
        while (current is not null)
        {
            crumbs.Insert(0, new { current.Id, current.Name });
            current = current.ParentId is null ? null : await db.Folders.FindAsync(current.ParentId);
        }
        return Ok(crumbs);
    }

    [HttpGet("info")]
    public async Task<IActionResult> GetInfo([FromQuery] string id)
    {
        var folder = await db.Folders.FindAsync(id);
        if (folder is null) return NotFound();
        return Ok(folder);
    }

    /// Acceso del caller al folder: si puede escribir y si es compartido (no propio).
    [HttpGet("access")]
    public async Task<IActionResult> GetAccess([FromQuery] string id)
    {
        var folder = await db.Folders.FirstOrDefaultAsync(f => f.Id == id);
        var isOwner = folder is null || folder.BlikonId == BlikonId;
        var access  = await ResolveAccessAsync(id);
        // existe = el folder está registrado (para distinguir "no existe" de "sin acceso")
        return Ok(new
        {
            hasAccess = access is not null,           // dueño o compartido con tu teléfono
            exists    = folder is not null,
            canWrite  = access is not null && access.CanWrite,
            isShared  = !isOwner && access is not null,
        });
    }

    [HttpDelete]
    public async Task<IActionResult> Delete([FromQuery] string id)
    {
        var access = await ResolveAccessAsync(id);
        if (access is null || !access.CanWrite)
            return StatusCode(403, new { message = "Sin permiso para eliminar esta carpeta" });

        var allIds = new List<string>();
        await CollectDescendants(id, allIds);

        var now   = DateTime.UtcNow;
        var files = await db.Files
            .Where(f => allIds.Contains(f.CoreFolderId) && f.DeletedAt == null)
            .ToListAsync();
        foreach (var f in files) f.DeletedAt = now;

        var folders = await db.Folders.Where(f => allIds.Contains(f.Id)).ToListAsync();
        db.Folders.RemoveRange(folders);

        await db.SaveChangesAsync();
        return Ok(new { deletedFolders = folders.Count, deletedFiles = files.Count });
    }

    [HttpPost("batch-delete")]
    public async Task<IActionResult> BatchDelete([FromBody] BatchDeleteFoldersRequest req)
    {
        if (req.Ids.Count == 0) return BadRequest();

        // Solo procesamos los folders donde el caller puede escribir.
        var allowed = new List<string>();
        foreach (var id in req.Ids)
        {
            var access = await ResolveAccessAsync(id);
            if (access is not null && access.CanWrite) allowed.Add(id);
        }
        if (allowed.Count == 0) return StatusCode(403, new { message = "Sin permiso para eliminar" });

        var allIds = new List<string>();
        foreach (var id in allowed)
            await CollectDescendants(id, allIds);

        var distinctIds = allIds.Distinct().ToList();
        var now         = DateTime.UtcNow;

        var files = await db.Files
            .Where(f => distinctIds.Contains(f.CoreFolderId) && f.DeletedAt == null)
            .ToListAsync();
        foreach (var f in files) f.DeletedAt = now;

        var folders = await db.Folders.Where(f => distinctIds.Contains(f.Id)).ToListAsync();
        db.Folders.RemoveRange(folders);

        await db.SaveChangesAsync();
        return Ok(new { deletedFolders = folders.Count, deletedFiles = files.Count });
    }

    private async Task CollectDescendants(string id, List<string> ids)
    {
        ids.Add(id);
        var childIds = await db.Folders
            .Where(f => f.ParentId == id)
            .Select(f => f.Id)
            .ToListAsync();
        foreach (var childId in childIds)
            await CollectDescendants(childId, ids);
    }
}

public record EnsureFolderRequest(string Path, string? ParentId = null);
public record BatchDeleteFoldersRequest(List<string> Ids);
public record FolderDto(string Id, string Name, string? ParentId, DateTime CreatedAt, int ChildCount, int FileCount);
