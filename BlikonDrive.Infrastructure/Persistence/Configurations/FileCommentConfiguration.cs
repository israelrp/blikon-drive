using BlikonDrive.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlikonDrive.Infrastructure.Persistence.Configurations;

public class FileCommentConfiguration : IEntityTypeConfiguration<FileComment>
{
    public void Configure(EntityTypeBuilder<FileComment> builder)
    {
        builder.ToTable("file_comments");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id).HasColumnName("id");
        builder.Property(c => c.FileId).HasColumnName("file_id");
        builder.Property(c => c.BlikonId).HasColumnName("blikon_id").IsRequired();
        builder.Property(c => c.Body).HasColumnName("body").IsRequired();
        builder.Property(c => c.CreatedAt).HasColumnName("created_at");
        builder.Property(c => c.DeletedAt).HasColumnName("deleted_at");

        builder.HasOne(c => c.File)
            .WithMany(f => f.Comments)
            .HasForeignKey(c => c.FileId);

        builder.HasIndex(c => c.FileId).HasDatabaseName("idx_comments_file_id");
        builder.HasQueryFilter(c => c.DeletedAt == null);
    }
}
