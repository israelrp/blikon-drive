namespace BlikonDrive.Core.Interfaces;

public interface IBlobStorageService
{
    Task<string> UploadChunkAsync(string blobPath, Stream chunk, long offset, long totalSize, CancellationToken ct = default);
    Task CommitBlocksAsync(string blobPath, IEnumerable<string> blockIds, CancellationToken ct = default);
    Task<Stream> DownloadAsync(string blobPath, CancellationToken ct = default);
    Task DeleteAsync(string blobPath, CancellationToken ct = default);
    Uri GetDownloadUri(string blobPath, TimeSpan expiry);
}
