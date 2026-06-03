using BlikonDrive.Core.Entities;
using BlikonDrive.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;

namespace BlikonDrive.Infrastructure.Persistence;

public class DriveDbContext(DbContextOptions<DriveDbContext> options) : DbContext(options)
{
    public DbSet<DriveFile> Files => Set<DriveFile>();
    public DbSet<FileComment> Comments => Set<FileComment>();
    public DbSet<DriveFolder> Folders => Set<DriveFolder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new DriveFileConfiguration());
        modelBuilder.ApplyConfiguration(new FileCommentConfiguration());
        modelBuilder.ApplyConfiguration(new DriveFolderConfiguration());
    }
}
