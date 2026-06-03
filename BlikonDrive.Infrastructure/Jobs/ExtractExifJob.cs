using BlikonDrive.Core.Interfaces;
using BlikonDrive.Infrastructure.Persistence;
using MetadataExtractor;
using MetadataExtractor.Formats.Exif;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BlikonDrive.Infrastructure.Jobs;

public class ExtractExifJob(DriveDbContext db, IBlobStorageService storage, ILogger<ExtractExifJob> logger)
{
    public async Task ExecuteAsync(Guid fileId)
    {
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == fileId);
        if (file is null) return;

        try
        {
            using var azureStream = await storage.DownloadAsync(file.AzureBlobPath);
            using var ms = new MemoryStream();
            await azureStream.CopyToAsync(ms);
            ms.Position = 0;

            var directories = ImageMetadataReader.ReadMetadata(ms);

            var exif = new Dictionary<string, object>();

            foreach (var directory in directories)
            {
                foreach (var tag in directory.Tags)
                {
                    if (tag.Description is not null)
                        exif[$"{directory.Name}/{tag.Name}"] = tag.Description;
                }
            }

            var gpsDir = directories.OfType<GpsDirectory>().FirstOrDefault();
            var location = gpsDir?.GetGeoLocation();
            if (location is not null)
            {
                exif["GPS/Latitude"] = location.Latitude;
                exif["GPS/Longitude"] = location.Longitude;
            }

            file.Exif = exif;
            file.ExifExtractedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "No se pudo extraer EXIF del archivo {FileId}", fileId);
        }
    }
}
