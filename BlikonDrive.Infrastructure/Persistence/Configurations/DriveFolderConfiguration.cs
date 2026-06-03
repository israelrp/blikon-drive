using BlikonDrive.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlikonDrive.Infrastructure.Persistence.Configurations;

public class DriveFolderConfiguration : IEntityTypeConfiguration<DriveFolder>
{
    public void Configure(EntityTypeBuilder<DriveFolder> builder)
    {
        builder.ToTable("folders");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.Id).HasColumnName("id");
        builder.Property(f => f.BlikonId).HasColumnName("blikon_id").IsRequired();
        builder.Property(f => f.ParentId).HasColumnName("parent_id");
        builder.Property(f => f.Name).HasColumnName("name").IsRequired();
        builder.Property(f => f.CreatedAt).HasColumnName("created_at");

        builder.HasOne(f => f.Parent)
            .WithMany(f => f.Children)
            .HasForeignKey(f => f.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(f => new { f.BlikonId, f.ParentId });
    }
}
