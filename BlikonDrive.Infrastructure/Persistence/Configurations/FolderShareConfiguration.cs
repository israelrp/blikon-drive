using BlikonDrive.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlikonDrive.Infrastructure.Persistence.Configurations;

public class FolderShareConfiguration : IEntityTypeConfiguration<FolderShare>
{
    public void Configure(EntityTypeBuilder<FolderShare> builder)
    {
        builder.ToTable("folder_shares");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id).HasColumnName("id");
        builder.Property(s => s.FolderId).HasColumnName("folder_id").IsRequired();
        builder.Property(s => s.OwnerBlikonId).HasColumnName("owner_blikon_id").IsRequired();
        builder.Property(s => s.PhoneNumber).HasColumnName("phone_number").IsRequired();
        builder.Property(s => s.Permission).HasColumnName("permission").IsRequired();
        builder.Property(s => s.CreatedAt).HasColumnName("created_at");

        // Búsqueda "shared with me" por teléfono
        builder.HasIndex(s => s.PhoneNumber);
        // Un folder no se comparte dos veces con el mismo teléfono
        builder.HasIndex(s => new { s.FolderId, s.PhoneNumber }).IsUnique();
    }
}
