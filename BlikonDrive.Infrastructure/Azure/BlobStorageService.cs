using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Blobs.Specialized;
using Azure.Storage.Sas;
using BlikonDrive.Core.Interfaces;
using Microsoft.Extensions.Configuration;

namespace BlikonDrive.Infrastructure.Azure;

public class BlobStorageService : IBlobStorageService
{
    private readonly BlobServiceClient _client;
    private readonly string _container;
    private readonly BlobContainerClient _containerClient;

    public BlobStorageService(IConfiguration config)
    {
        _client = new(config["Azure:StorageConnectionString"]);
        _container = config["Azure:ContainerName"] ?? "blikon-drive";
        _containerClient = _client.GetBlobContainerClient(_container);
        _containerClient.CreateIfNotExists(PublicAccessType.None);
    }

    public async Task<string> UploadChunkAsync(string blobPath, Stream chunk, long offset, long totalSize, CancellationToken ct = default)
    {
        var blockClient = GetBlockClient(blobPath);
        var blockId = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        await blockClient.StageBlockAsync(blockId, chunk, cancellationToken: ct);
        return blockId;
    }

    public async Task CommitBlocksAsync(string blobPath, IEnumerable<string> blockIds, CancellationToken ct = default)
    {
        var blockClient = GetBlockClient(blobPath);
        await blockClient.CommitBlockListAsync(blockIds, cancellationToken: ct);
    }

    public async Task<Stream> DownloadAsync(string blobPath, CancellationToken ct = default)
    {
        var blob = GetBlobClient(blobPath);
        var response = await blob.DownloadStreamingAsync(cancellationToken: ct);
        return response.Value.Content;
    }

    public async Task DeleteAsync(string blobPath, CancellationToken ct = default)
    {
        var blob = GetBlobClient(blobPath);
        await blob.DeleteIfExistsAsync(DeleteSnapshotsOption.IncludeSnapshots, cancellationToken: ct);
    }

    // Copia server-side dentro del mismo contenedor (para "copiar archivo").
    public async Task CopyAsync(string sourcePath, string destPath, CancellationToken ct = default)
    {
        var dest      = GetBlobClient(destPath);
        var sourceUri = GetDownloadUri(sourcePath, TimeSpan.FromMinutes(10)); // SAS de lectura
        var op = await dest.StartCopyFromUriAsync(sourceUri, cancellationToken: ct);
        await op.WaitForCompletionAsync(ct);
    }

    public Uri GetDownloadUri(string blobPath, TimeSpan expiry, string? contentType = null, bool inline = false, string? fileName = null)
    {
        var blob = GetBlobClient(blobPath);
        var sasBuilder = new BlobSasBuilder(BlobSasPermissions.Read, DateTimeOffset.UtcNow.Add(expiry))
        {
            BlobContainerName = _container,
            BlobName = blobPath,
            Resource = "b"
        };

        // Override de headers de respuesta para la vista previa / descarga.
        if (!string.IsNullOrEmpty(contentType))
            sasBuilder.ContentType = contentType;
        if (inline)
            sasBuilder.ContentDisposition = "inline";
        else if (!string.IsNullOrEmpty(fileName))
            sasBuilder.ContentDisposition = $"attachment; filename=\"{fileName}\"";

        return blob.GenerateSasUri(sasBuilder);
    }

    private BlockBlobClient GetBlockClient(string blobPath) =>
        _containerClient.GetBlockBlobClient(blobPath);

    private BlobClient GetBlobClient(string blobPath) =>
        _containerClient.GetBlobClient(blobPath);
}
