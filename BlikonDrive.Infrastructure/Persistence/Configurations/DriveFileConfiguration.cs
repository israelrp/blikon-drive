using BlikonDrive.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlikonDrive.Infrastructure.Persistence.Configurations;

public class DriveFileConfiguration : IEntityTypeConfiguration<DriveFile>
{
    public void Configure(EntityTypeBuilder<DriveFile> builder)
    {
        builder.ToTable("files");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.Id).HasColumnName("id");
        builder.Property(f => f.BlikonId).HasColumnName("blikon_id").IsRequired();
        builder.Property(f => f.CoreFolderId).HasColumnName("core_folder_id").IsRequired();
        builder.Property(f => f.AzureBlobPath).HasColumnName("azure_blob_path").IsRequired();
        builder.Property(f => f.UploadStatus).HasColumnName("upload_status").HasConversion<string>();
        builder.Property(f => f.Name).HasColumnName("name").IsRequired();
        builder.Property(f => f.Extension).HasColumnName("extension");
        builder.Property(f => f.MimeType).HasColumnName("mime_type");
        builder.Property(f => f.SizeBytes).HasColumnName("size_bytes");
        builder.Property(f => f.Title).HasColumnName("title");
        builder.Property(f => f.Description).HasColumnName("description");
        builder.Property(f => f.Tags).HasColumnName("tags").HasColumnType("text[]");
        builder.Property(f => f.Exif).HasColumnName("exif").HasColumnType("jsonb");
        builder.Property(f => f.ExifExtractedAt).HasColumnName("exif_extracted_at");
        builder.Property(f => f.ContentText).HasColumnName("content_text");
        builder.Property(f => f.ContentIndexedAt).HasColumnName("content_indexed_at");
        builder.Property(f => f.CreatedAt).HasColumnName("created_at");
        builder.Property(f => f.UpdatedAt).HasColumnName("updated_at");
        builder.Property(f => f.DeletedAt).HasColumnName("deleted_at");

        builder.HasIndex(f => f.BlikonId).HasDatabaseName("idx_files_blikon_id");
        builder.HasIndex(f => f.CoreFolderId).HasDatabaseName("idx_files_core_folder");
        builder.HasIndex(f => f.DeletedAt).HasFilter("deleted_at IS NULL");

        builder.HasQueryFilter(f => f.DeletedAt == null);
    }
}
