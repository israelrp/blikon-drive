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

    [HttpPost("ensure")]
    public async Task<IActionResult> Ensure([FromBody] EnsureFolderRequest req)
    {
        var blikonId = BlikonId;
        var segments = req.Path
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => s.ToLower())
            .ToList();

        if (segments.Count == 0) return BadRequest("El path no puede estar vacío.");

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
                    BlikonId = blikonId,
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
        var blikonId = BlikonId;
        var children = await db.Folders
            .Where(f => f.BlikonId == blikonId && f.ParentId == parentId)
            .OrderBy(f => f.Name)
            .Select(f => new FolderDto(
                f.Id, f.Name, f.ParentId, f.CreatedAt,
                db.Folders.Count(c => c.ParentId == f.Id),
                db.Files.Count(x => x.CoreFolderId == f.Id)))
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

    [HttpDelete]
    public async Task<IActionResult> Delete([FromQuery] string id)
    {
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

        var allIds = new List<string>();
        foreach (var id in req.Ids)
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
