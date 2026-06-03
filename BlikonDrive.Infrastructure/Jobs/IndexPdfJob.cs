using BlikonDrive.Core.Interfaces;
using BlikonDrive.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using UglyToad.PdfPig;

namespace BlikonDrive.Infrastructure.Jobs;

public class IndexPdfJob(DriveDbContext db, IBlobStorageService storage, ILogger<IndexPdfJob> logger)
{
    public async Task ExecuteAsync(Guid fileId)
    {
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == fileId);
        if (file is null) return;

        try
        {
            using var stream = await storage.DownloadAsync(file.AzureBlobPath);
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms);
            ms.Position = 0;

            using var pdf = PdfDocument.Open(ms.ToArray());
            var text = string.Join(" ", pdf.GetPages().Select(p => p.Text));

            file.ContentText = text.Length > 1_000_000 ? text[..1_000_000] : text;
            file.ContentIndexedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "No se pudo indexar el PDF del archivo {FileId}", fileId);
        }
    }
}
