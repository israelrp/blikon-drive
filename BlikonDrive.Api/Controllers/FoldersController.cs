using BlikonDrive.Core.Entities;
using BlikonDrive.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlikonDrive.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FoldersController(DriveDbContext db) : ControllerBase
{
    private const string DevBlikonId = "dev-blikon-001";

    /// <summary>
    /// Recibe un path como "proyectos/clientes/blikon" y crea todos los folders
    /// intermedios que no existan. Devuelve el folder hoja (el último).
    /// También acepta un slug simple: "folder-test-002"
    /// </summary>
    [HttpPost("ensure")]
    public async Task<IActionResult> Ensure([FromBody] EnsureFolderRequest req)
    {
        // Normalizar a minúsculas y limpiar
        var segments = req.Path
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => s.ToLower())
            .ToList();

        if (segments.Count == 0)
            return BadRequest("El path no puede estar vacío.");

        string? parentId = req.ParentId?.ToLower();
        DriveFolder? leaf = null;

        for (int i = 0; i < segments.Count; i++)
        {
            var id = parentId is null ? segments[i] : $"{parentId}/{segments[i]}";

            var folder = await db.Folders.FindAsync(id);
            if (folder is null)
            {
                folder = new DriveFolder
                {
                    Id       = id,
                    BlikonId = DevBlikonId,
                    ParentId = parentId,
                    Name     = segments[i],
                };
                db.Folders.Add(folder);
                await db.SaveChangesAsync();
            }

            parentId = id;
            leaf     = folder;
        }

        return Ok(leaf);
    }

    // GET /api/folders → raíces
    [HttpGet]
    public async Task<IActionResult> GetRoots()
    {
        var roots = await db.Folders
            .Where(f => f.BlikonId == DevBlikonId && f.ParentId == null)
            .OrderBy(f => f.Name)
            .Select(f => new FolderDto(
                f.Id, f.Name, f.ParentId, f.CreatedAt,
                db.Folders.Count(c => c.ParentId == f.Id),
                db.Files.Count(x => x.CoreFolderId == f.Id)))
            .ToListAsync();

        return Ok(roots);
    }

    // GET /api/folders/children?parentId=proyectos/clientes
    [HttpGet("children")]
    public async Task<IActionResult> GetChildren([FromQuery] string? parentId)
    {
        var children = await db.Folders
            .Where(f => f.BlikonId == DevBlikonId && f.ParentId == parentId)
            .OrderBy(f => f.Name)
            .Select(f => new FolderDto(
                f.Id, f.Name, f.ParentId, f.CreatedAt,
                db.Folders.Count(c => c.ParentId == f.Id),
                db.Files.Count(x => x.CoreFolderId == f.Id)))
            .ToListAsync();

        return Ok(children);
    }

    // GET /api/folders/breadcrumb?id=proyectos/clientes/blikon
    [HttpGet("breadcrumb")]
    public async Task<IActionResult> GetBreadcrumb([FromQuery] string id)
    {
        var crumbs = new List<object>();
        var current = await db.Folders.FindAsync(id);

        while (current is not null)
        {
            crumbs.Insert(0, new { current.Id, current.Name });
            current = current.ParentId is null
                ? null
                : await db.Folders.FindAsync(current.ParentId);
        }

        return Ok(crumbs);
    }

    // GET /api/folders/info?id=proyectos/clientes
    [HttpGet("info")]
    public async Task<IActionResult> GetInfo([FromQuery] string id)
    {
        var folder = await db.Folders.FindAsync(id);
        if (folder is null) return NotFound();
        return Ok(folder);
    }
}

public record EnsureFolderRequest(string Path, string? ParentId = null);
public record FolderDto(string Id, string Name, string? ParentId, DateTime CreatedAt, int ChildCount, int FileCount);
