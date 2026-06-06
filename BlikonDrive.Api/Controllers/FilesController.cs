using BlikonDrive.Api.Services;
using BlikonDrive.Core.Entities;
using BlikonDrive.Core.Interfaces;
using BlikonDrive.Infrastructure.Jobs;
using BlikonDrive.Infrastructure.Persistence;
using Hangfire;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlikonDrive.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FilesController(DriveDbContext db, IBlobStorageService storage, FileEventService events) : ControllerBase
{
    // Lee el BlikonId del header X-Blikon-Id (enviado por web y sync-desk).
    // En dev usa el fallback si no viene el header.
    private string BlikonId =>
        Request.Headers.TryGetValue("X-Blikon-Id", out var v) && !string.IsNullOrWhiteSpace(v)
            ? v.ToString()
            : "dev-blikon-001";

    private string Phone =>
        Request.Headers.TryGetValue("X-Phone-Number", out var v) && !string.IsNullOrWhiteSpace(v)
            ? new string(v.ToString().Where(char.IsDigit).ToArray())
            : "";

    /// Resultado de acceso a un folder: dueño real + si el caller puede escribir.
    private record Access(string Owner, bool CanWrite);

    /// Resuelve el acceso del caller a un folder:
    /// - Dueño → (caller, write)
    /// - Compartido como editor (folder o ancestro) → (dueño, write)
    /// - Compartido como viewer → (dueño, read-only)
    /// - Sin acceso → null
    /// - Folder aún no registrado → (caller, write) (lo está creando)
    private async Task<Access?> ResolveAccessAsync(string coreFolderId)
    {
        var folder = await db.Folders.FirstOrDefaultAsync(f => f.Id == coreFolderId);
        if (folder is null) return new Access(BlikonId, true);
        if (folder.BlikonId == BlikonId) return new Access(BlikonId, true);

        if (Phone.Length >= 10)
        {
            var shares = await db.FolderShares
                .Where(s => s.PhoneNumber == Phone)
                .Select(s => new { s.FolderId, s.Permission })
                .ToListAsync();
            var matches = shares
                .Where(s => coreFolderId == s.FolderId || coreFolderId.StartsWith(s.FolderId + "/"))
                .ToList();
            if (matches.Count > 0)
                return new Access(folder.BlikonId, matches.Any(s => s.Permission == "editor"));
        }
        return null;
    }

    [HttpGet("folder")]
    public async Task<IActionResult> GetByFolder([FromQuery] string coreFolderId)
    {
        var access = await ResolveAccessAsync(coreFolderId);
        if (access is null) return Ok(Array.Empty<object>());
        var owner = access.Owner;

        var files = await db.Files
            .Where(f => f.BlikonId == owner && f.CoreFolderId == coreFolderId && f.DeletedAt == null)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new
            {
                f.Id, f.Name, f.Extension, f.MimeType, f.SizeBytes,
                f.Title, f.Description, f.Tags, f.UploadStatus, f.CoreFolderId, f.CreatedAt
            })
            .ToListAsync();

        return Ok(files);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var file = await db.Files.Include(f => f.Comments).FirstOrDefaultAsync(f => f.Id == id);
        if (file is null) return NotFound();
        return Ok(file);
    }

    [HttpPost("upload/init")]
    public async Task<IActionResult> InitUpload([FromBody] InitUploadRequest req)
    {
        var access = await ResolveAccessAsync(req.CoreFolderId);
        if (access is null || !access.CanWrite)
            return StatusCode(403, new { message = "Sin permiso de escritura en este folder" });

        // Los archivos subidos a un folder compartido se guardan bajo el dueño,
        // así el dueño y demás invitados los ven.
        var blikonId = access.Owner;
        var blobPath = $"{blikonId}/{req.CoreFolderId}/{Guid.NewGuid()}/{req.FileName}";

        var file = new DriveFile
        {
            Id            = Guid.NewGuid(),
            BlikonId      = blikonId,
            CoreFolderId  = req.CoreFolderId,
            AzureBlobPath = blobPath,
            UploadStatus  = UploadStatus.Pending,
            Name          = req.FileName,
            Extension     = Path.GetExtension(req.FileName).TrimStart('.').ToLower(),
            MimeType      = req.MimeType,
            SizeBytes     = req.SizeBytes
        };

        db.Files.Add(file);
        await db.SaveChangesAsync();

        return Ok(new { file.Id, BlobPath = blobPath });
    }

    [HttpPost("upload/{fileId}/chunk")]
    public async Task<IActionResult> UploadChunk(Guid fileId, IFormFile chunk, [FromQuery] long offset, [FromQuery] long totalSize)
    {
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == fileId);
        if (file is null) return NotFound();

        file.UploadStatus = UploadStatus.Uploading;
        await db.SaveChangesAsync();

        using var stream = chunk.OpenReadStream();
        var blockId = await storage.UploadChunkAsync(file.AzureBlobPath, stream, offset, totalSize);

        return Ok(new { BlockId = blockId });
    }

    [HttpPost("upload/{fileId}/commit")]
    public async Task<IActionResult> CommitUpload(Guid fileId, [FromBody] CommitUploadRequest req)
    {
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == fileId);
        if (file is null) return NotFound();

        var access = await ResolveAccessAsync(file.CoreFolderId);
        if (access is null || !access.CanWrite)
            return StatusCode(403, new { message = "Sin permiso de escritura" });

        await storage.CommitBlocksAsync(file.AzureBlobPath, req.BlockIds);

        file.UploadStatus = UploadStatus.Complete;
        file.UpdatedAt    = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var mime = file.MimeType ?? "";
        if (mime.StartsWith("image/"))
            BackgroundJob.Enqueue<ExtractExifJob>(j => j.ExecuteAsync(file.Id));
        else if (mime == "application/pdf")
            BackgroundJob.Enqueue<IndexPdfJob>(j => j.ExecuteAsync(file.Id));

        events.Notify(new FileEvent("file.added", file.CoreFolderId, file.Id, file.Name));
        return Ok(new { file.Id, file.UploadStatus });
    }

    /// Espacio consumido por el usuario (suma de sus archivos no eliminados).
    [HttpGet("storage")]
    public async Task<IActionResult> Storage()
    {
        var used = await db.Files
            .Where(f => f.BlikonId == BlikonId && f.DeletedAt == null)
            .SumAsync(f => f.SizeBytes ?? 0);
        var count = await db.Files.CountAsync(f => f.BlikonId == BlikonId && f.DeletedAt == null);

        const long quota = 10L * 1024 * 1024 * 1024 * 1024; // 10 TB por usuario (ajustable)
        return Ok(new { usedBytes = used, quotaBytes = quota, fileCount = count });
    }

    [HttpGet("{id}/download")]
    public IActionResult GetDownloadUrl(Guid id, [FromQuery] bool inline = false)
    {
        var file = db.Files.FirstOrDefault(f => f.Id == id);
        if (file is null) return NotFound();
        // inline=true → vista previa (render en navegador); si no → descarga con nombre.
        var uri = storage.GetDownloadUri(
            file.AzureBlobPath, TimeSpan.FromMinutes(15),
            contentType: inline ? file.MimeType : null,
            inline:      inline,
            fileName:    inline ? null : file.Name);
        return Ok(new { Url = uri.ToString() });
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, [FromQuery] string? coreFolderId)
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<object>());

        var term  = q.Trim();
        var lower = term.ToLower();
        var like  = $"%{lower}%";

        var query = db.Files.Where(f => f.BlikonId == BlikonId && f.DeletedAt == null);

        // Si se pasa un folder, buscamos en él Y en sus subfolders (slug "a/b/c").
        if (!string.IsNullOrWhiteSpace(coreFolderId))
        {
            var prefix = coreFolderId + "/";
            query = query.Where(f => f.CoreFolderId == coreFolderId || f.CoreFolderId.StartsWith(prefix));
        }

        query = query.Where(f =>
            EF.Functions.ILike(f.Name, like)              // nombre del archivo (incluye extensión)
            || (f.Title != null && EF.Functions.ILike(f.Title, like))
            || (f.Description != null && EF.Functions.ILike(f.Description, like))
            || (f.Extension != null && EF.Functions.ILike(f.Extension, like))
            || f.Tags.Any(t => EF.Functions.ILike(t, like))
            || (f.ContentText != null && EF.Functions.ToTsVector("spanish", f.ContentText)
                .Matches(EF.Functions.PlainToTsQuery("spanish", term)))
        );

        var results = await query
            .OrderByDescending(f => f.CreatedAt)
            .Take(100)
            .Select(f => new
            {
                f.Id, f.Name, f.Title, f.Extension, f.MimeType,
                f.SizeBytes, f.Tags, f.CoreFolderId, f.CreatedAt
            })
            .ToListAsync();

        return Ok(results);
    }

    [HttpPost("{id}/metadata")]
    public async Task<IActionResult> UpdateMetadata(Guid id, [FromBody] UpdateMetadataRequest req)
    {
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == id);
        if (file is null) return NotFound();
        var access = await ResolveAccessAsync(file.CoreFolderId);
        if (access is null || !access.CanWrite)
            return StatusCode(403, new { message = "Sin permiso de escritura" });
        file.Title       = req.Title       ?? file.Title;
        file.Description = req.Description ?? file.Description;
        if (req.Tags is not null) file.Tags = req.Tags;
        file.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { file.Id, file.Title, file.Description, file.Tags });
    }

    [HttpPost("{id}/comments")]
    public async Task<IActionResult> AddComment(Guid id, [FromBody] AddCommentRequest req)
    {
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == id);
        if (file is null) return NotFound();
        var access = await ResolveAccessAsync(file.CoreFolderId);
        if (access is null || !access.CanWrite)
            return StatusCode(403, new { message = "Sin permiso de escritura" });
        var comment = new FileComment
        {
            Id = Guid.NewGuid(), FileId = id,
            BlikonId = BlikonId, Body = req.Body
        };
        db.Comments.Add(comment);
        await db.SaveChangesAsync();
        return Ok(comment);
    }

    // ── Mover / Copiar ───────────────────────────────────────────────────────

    /// Mueve un archivo a otro folder. Requiere escritura en origen y destino.
    /// El archivo pasa a pertenecer al dueño del folder destino.
    [HttpPost("{id}/move")]
    public async Task<IActionResult> Move(Guid id, [FromBody] MoveCopyRequest req)
    {
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == id && f.DeletedAt == null);
        if (file is null) return NotFound();

        var src = await ResolveAccessAsync(file.CoreFolderId);
        if (src is null || !src.CanWrite) return StatusCode(403, new { message = "Sin permiso en el origen" });
        var dst = await ResolveAccessAsync(req.TargetFolderId);
        if (dst is null || !dst.CanWrite) return StatusCode(403, new { message = "Sin permiso en el destino" });

        var fromFolder = file.CoreFolderId;
        file.CoreFolderId = req.TargetFolderId;
        file.BlikonId     = dst.Owner;          // pertenece al dueño del destino
        file.UpdatedAt    = DateTime.UtcNow;
        await db.SaveChangesAsync();

        events.Notify(new FileEvent("file.moved", req.TargetFolderId, file.Id, file.Name));
        events.Notify(new FileEvent("file.removed", fromFolder, file.Id, file.Name));
        return Ok(new { file.Id, file.CoreFolderId });
    }

    /// Copia un archivo a otro folder (copia el blob). Requiere lectura del
    /// origen y escritura en el destino.
    [HttpPost("{id}/copy")]
    public async Task<IActionResult> Copy(Guid id, [FromBody] MoveCopyRequest req)
    {
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == id && f.DeletedAt == null);
        if (file is null) return NotFound();

        var src = await ResolveAccessAsync(file.CoreFolderId);
        if (src is null) return StatusCode(403, new { message = "Sin acceso al archivo" });
        var dst = await ResolveAccessAsync(req.TargetFolderId);
        if (dst is null || !dst.CanWrite) return StatusCode(403, new { message = "Sin permiso en el destino" });

        var newId   = Guid.NewGuid();
        var newPath = $"{dst.Owner}/{req.TargetFolderId}/{newId}/{file.Name}";
        await storage.CopyAsync(file.AzureBlobPath, newPath);

        var copy = new DriveFile
        {
            Id               = newId,
            BlikonId         = dst.Owner,
            CoreFolderId     = req.TargetFolderId,
            AzureBlobPath    = newPath,
            UploadStatus     = UploadStatus.Complete,
            Name             = file.Name,
            Extension        = file.Extension,
            MimeType         = file.MimeType,
            SizeBytes        = file.SizeBytes,
            Title            = file.Title,
            Description      = file.Description,
            Tags             = new List<string>(file.Tags),
            Exif             = file.Exif,
            ExifExtractedAt  = file.ExifExtractedAt,
            ContentText      = file.ContentText,
            ContentIndexedAt = file.ContentIndexedAt,
        };
        db.Files.Add(copy);
        await db.SaveChangesAsync();

        events.Notify(new FileEvent("file.added", req.TargetFolderId, copy.Id, copy.Name));
        return Ok(new { copy.Id, copy.CoreFolderId });
    }

    [HttpPost("batch-move")]
    public async Task<IActionResult> BatchMove([FromBody] BatchMoveCopyRequest req)
    {
        if (req.Ids.Count == 0) return BadRequest();
        var dst = await ResolveAccessAsync(req.TargetFolderId);
        if (dst is null || !dst.CanWrite) return StatusCode(403, new { message = "Sin permiso en el destino" });

        var files = await db.Files.Where(f => req.Ids.Contains(f.Id) && f.DeletedAt == null).ToListAsync();
        var moved = 0;
        var cache = new Dictionary<string, bool>();
        foreach (var f in files)
        {
            if (!cache.TryGetValue(f.CoreFolderId, out var canWrite))
            {
                var a = await ResolveAccessAsync(f.CoreFolderId);
                canWrite = a is not null && a.CanWrite;
                cache[f.CoreFolderId] = canWrite;
            }
            if (!canWrite) continue;
            f.CoreFolderId = req.TargetFolderId;
            f.BlikonId     = dst.Owner;
            f.UpdatedAt    = DateTime.UtcNow;
            moved++;
        }
        await db.SaveChangesAsync();
        events.Notify(new FileEvent("file.added", req.TargetFolderId, Guid.Empty, ""));
        return Ok(new { moved });
    }

    [HttpPost("batch-copy")]
    public async Task<IActionResult> BatchCopy([FromBody] BatchMoveCopyRequest req)
    {
        if (req.Ids.Count == 0) return BadRequest();
        var dst = await ResolveAccessAsync(req.TargetFolderId);
        if (dst is null || !dst.CanWrite) return StatusCode(403, new { message = "Sin permiso en el destino" });

        var files = await db.Files.Where(f => req.Ids.Contains(f.Id) && f.DeletedAt == null).ToListAsync();
        var copied = 0;
        foreach (var f in files)
        {
            var access = await ResolveAccessAsync(f.CoreFolderId);
            if (access is null) continue; // sin acceso al origen
            var newId   = Guid.NewGuid();
            var newPath = $"{dst.Owner}/{req.TargetFolderId}/{newId}/{f.Name}";
            await storage.CopyAsync(f.AzureBlobPath, newPath);
            db.Files.Add(new DriveFile
            {
                Id = newId, BlikonId = dst.Owner, CoreFolderId = req.TargetFolderId,
                AzureBlobPath = newPath, UploadStatus = UploadStatus.Complete,
                Name = f.Name, Extension = f.Extension, MimeType = f.MimeType, SizeBytes = f.SizeBytes,
                Title = f.Title, Description = f.Description, Tags = new List<string>(f.Tags),
                Exif = f.Exif, ExifExtractedAt = f.ExifExtractedAt,
                ContentText = f.ContentText, ContentIndexedAt = f.ContentIndexedAt,
            });
            copied++;
        }
        await db.SaveChangesAsync();
        events.Notify(new FileEvent("file.added", req.TargetFolderId, Guid.Empty, ""));
        return Ok(new { copied });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == id);
        if (file is null) return NotFound();
        var access = await ResolveAccessAsync(file.CoreFolderId);
        if (access is null || !access.CanWrite)
            return StatusCode(403, new { message = "Sin permiso para eliminar" });
        file.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("batch-delete")]
    public async Task<IActionResult> BatchDelete([FromBody] BatchDeleteRequest req)
    {
        if (req.Ids.Count == 0) return BadRequest();
        var now   = DateTime.UtcNow;
        var files = await db.Files.Where(f => req.Ids.Contains(f.Id)).ToListAsync();

        // Solo eliminamos aquellos donde el caller tiene permiso de escritura.
        // Cacheamos el acceso por folder para no resolver el mismo dos veces.
        var accessCache = new Dictionary<string, bool>();
        var deleted = 0;
        foreach (var f in files)
        {
            if (!accessCache.TryGetValue(f.CoreFolderId, out var canWrite))
            {
                var access = await ResolveAccessAsync(f.CoreFolderId);
                canWrite = access is not null && access.CanWrite;
                accessCache[f.CoreFolderId] = canWrite;
            }
            if (!canWrite) continue;
            f.DeletedAt = now;
            deleted++;
        }
        await db.SaveChangesAsync();
        return Ok(new { deleted });
    }
}

public record InitUploadRequest(string CoreFolderId, string FileName, string? MimeType, long? SizeBytes);
public record CommitUploadRequest(List<string> BlockIds);
public record UpdateMetadataRequest(string? Title, string? Description, List<string>? Tags);
public record BatchDeleteRequest(List<Guid> Ids);
public record AddCommentRequest(string Body);
public record MoveCopyRequest(string TargetFolderId);
public record BatchMoveCopyRequest(List<Guid> Ids, string TargetFolderId);
