namespace BlikonDrive.Core.Entities;

public class FileComment
{
    public Guid Id { get; set; }
    public Guid FileId { get; set; }
    public string BlikonId { get; set; } = default!;
    public string Body { get; set; } = default!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt { get; set; }

    public DriveFile File { get; set; } = default!;
}
