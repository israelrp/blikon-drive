namespace BlikonDrive.Core.Entities;

/// <summary>
/// Comparte un folder con un usuario identificado por su número de teléfono
/// (código de país + 10 dígitos, solo dígitos). Permiso "viewer" o "editor".
/// </summary>
public class FolderShare
{
    public Guid Id { get; set; }
    public string FolderId { get; set; } = default!;       // DriveFolder.Id (slug)
    public string OwnerBlikonId { get; set; } = default!;  // quién comparte
    public string PhoneNumber { get; set; } = default!;    // invitado, solo dígitos con código país
    public string Permission { get; set; } = "viewer";     // "viewer" | "editor"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
