namespace BlikonDrive.Core.Interfaces;

public interface IBlobStorageService
{
    Task<string> UploadChunkAsync(string blobPath, Stream chunk, long offset, long totalSize, CancellationToken ct = default);
    Task CommitBlocksAsync(string blobPath, IEnumerable<string> blockIds, CancellationToken ct = default);
    Task<Stream> DownloadAsync(string blobPath, CancellationToken ct = default);
    Task DeleteAsync(string blobPath, CancellationToken ct = default);
    /// SAS URL de lectura. Si se pasa contentType/inline, se overridean en la
    /// respuesta para que el navegador renderice inline (vista previa) en vez de descargar.
    Uri GetDownloadUri(string blobPath, TimeSpan expiry, string? contentType = null, bool inline = false, string? fileName = null);
}
