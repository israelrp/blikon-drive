namespace BlikonDrive.Core.Entities;

public class DriveFolder
{
    public string Id { get; set; } = default!;      // slug — e.g. "proyectos"
    public string BlikonId { get; set; } = default!;
    public string? ParentId { get; set; }
    public string Name { get; set; } = default!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DriveFolder? Parent { get; set; }
    public ICollection<DriveFolder> Children { get; set; } = [];
}
