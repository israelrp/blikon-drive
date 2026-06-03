namespace BlikonDrive.Core.Entities;

public class DriveFile
{
    public Guid Id { get; set; }
    public string BlikonId { get; set; } = default!;
    public string CoreFolderId { get; set; } = default!;
    public string AzureBlobPath { get; set; } = default!;
    public UploadStatus UploadStatus { get; set; }

    public string Name { get; set; } = default!;
    public string? Extension { get; set; }
    public string? MimeType { get; set; }
    public long? SizeBytes { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public List<string> Tags { get; set; } = [];

    public Dictionary<string, object>? Exif { get; set; }
    public DateTime? ExifExtractedAt { get; set; }

    public string? ContentText { get; set; }
    public DateTime? ContentIndexedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    public ICollection<FileComment> Comments { get; set; } = [];
}

public enum UploadStatus
{
    Pending,
    Uploading,
    Complete,
    Failed
}
