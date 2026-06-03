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
    // BlikonId fijo para desarrollo hasta integrar ValidaCel
    private const string DevBlikonId = "dev-blikon-001";
    private const string DevUsuarioId = "dev-usuario-001";

    [HttpGet("folder")]
    public async Task<IActionResult> GetByFolder([FromQuery] string coreFolderId)
    {
        var files = await db.Files
            .Where(f => f.CoreFolderId == coreFolderId)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new
            {
                f.Id, f.Name, f.Extension, f.MimeType, f.SizeBytes,
                f.Title, f.Description, f.Tags, f.UploadStatus, f.CreatedAt
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
        var blobPath = $"{DevBlikonId}/{req.CoreFolderId}/{Guid.NewGuid()}/{req.FileName}";

        var file = new DriveFile
        {
            Id = Guid.NewGuid(),
            BlikonId = DevBlikonId,
            CoreFolderId = req.CoreFolderId,
            AzureBlobPath = blobPath,
            UploadStatus = UploadStatus.Pending,
            Name = req.FileName,
            Extension = Path.GetExtension(req.FileName).TrimStart('.').ToLower(),
            MimeType = req.MimeType,
            SizeBytes = req.SizeBytes
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

        await storage.CommitBlocksAsync(file.AzureBlobPath, req.BlockIds);

        file.UploadStatus = UploadStatus.Complete;
        file.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var mime = file.MimeType ?? "";
        if (mime.StartsWith("image/"))
            BackgroundJob.Enqueue<ExtractExifJob>(j => j.ExecuteAsync(file.Id));
        else if (mime == "application/pdf")
            BackgroundJob.Enqueue<IndexPdfJob>(j => j.ExecuteAsync(file.Id));

        // Notificar a los clientes conectados via SSE
        events.Notify(new FileEvent("file.added", file.CoreFolderId, file.Id, file.Name));

        return Ok(new { file.Id, file.UploadStatus });
    }

    [HttpGet("{id}/download")]
    public IActionResult GetDownloadUrl(Guid id)
    {
        // TODO: validar permiso contra Blikon Core antes de generar URL
        var file = db.Files.FirstOrDefault(f => f.Id == id);
        if (file is null) return NotFound();

        var uri = storage.GetDownloadUri(file.AzureBlobPath, TimeSpan.FromMinutes(15));
        return Ok(new { Url = uri.ToString() });
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, [FromQuery] string? coreFolderId)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(Array.Empty<object>());

        var term  = q.Trim();
        var lower = term.ToLower();
        var like  = $"%{lower}%";

        var query = db.Files.Where(f => f.BlikonId == DevBlikonId && f.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(coreFolderId))
            query = query.Where(f => f.CoreFolderId == coreFolderId);

        query = query.Where(f =>
            // 1. Nombre/título por ILIKE — captura palabras parciales y cualquier input
            EF.Functions.ILike(f.Name, like)
            || (f.Title != null && EF.Functions.ILike(f.Title, like))
            || (f.Description != null && EF.Functions.ILike(f.Description, like))

            // 2. Extensión exacta — buscar "jpg", "pdf", "mp4"...
            || (f.Extension != null && f.Extension.ToLower() == lower)

            // 3. Tags
            || f.Tags.Any(t => EF.Functions.ILike(t, like))

            // 4. Full-text en contenido indexado (PDFs) con plainto_tsquery (más tolerante)
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

        file.Title = req.Title ?? file.Title;
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

        var comment = new FileComment
        {
            Id = Guid.NewGuid(),
            FileId = id,
            BlikonId = DevBlikonId,
            Body = req.Body
        };

        db.Comments.Add(comment);
        await db.SaveChangesAsync();
        return Ok(comment);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == id);
        if (file is null) return NotFound();

        file.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("batch-delete")]
    public async Task<IActionResult> BatchDelete([FromBody] BatchDeleteRequest req)
    {
        if (req.Ids.Count == 0) return BadRequest();

        var now = DateTime.UtcNow;
        var files = await db.Files
            .Where(f => req.Ids.Contains(f.Id) && f.BlikonId == DevBlikonId)
            .ToListAsync();

        foreach (var f in files)
            f.DeletedAt = now;

        await db.SaveChangesAsync();
        return Ok(new { deleted = files.Count });
    }
}

public record InitUploadRequest(string CoreFolderId, string FileName, string? MimeType, long? SizeBytes);
public record CommitUploadRequest(List<string> BlockIds);
public record UpdateMetadataRequest(string? Title, string? Description, List<string>? Tags);
public record BatchDeleteRequest(List<Guid> Ids);
public record AddCommentRequest(string Body);
