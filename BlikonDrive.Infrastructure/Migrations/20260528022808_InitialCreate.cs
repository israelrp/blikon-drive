using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlikonDrive.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "files",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    blikon_id = table.Column<string>(type: "text", nullable: false),
                    core_folder_id = table.Column<string>(type: "text", nullable: false),
                    azure_blob_path = table.Column<string>(type: "text", nullable: false),
                    upload_status = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    extension = table.Column<string>(type: "text", nullable: true),
                    mime_type = table.Column<string>(type: "text", nullable: true),
                    size_bytes = table.Column<long>(type: "bigint", nullable: true),
                    title = table.Column<string>(type: "text", nullable: true),
                    description = table.Column<string>(type: "text", nullable: true),
                    tags = table.Column<List<string>>(type: "text[]", nullable: false),
                    exif = table.Column<Dictionary<string, object>>(type: "jsonb", nullable: true),
                    exif_extracted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    content_text = table.Column<string>(type: "text", nullable: true),
                    content_indexed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_files", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "file_comments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    file_id = table.Column<Guid>(type: "uuid", nullable: false),
                    blikon_id = table.Column<string>(type: "text", nullable: false),
                    body = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_file_comments", x => x.id);
                    table.ForeignKey(
                        name: "FK_file_comments_files_file_id",
                        column: x => x.file_id,
                        principalTable: "files",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_comments_file_id",
                table: "file_comments",
                column: "file_id");

            migrationBuilder.CreateIndex(
                name: "idx_files_blikon_id",
                table: "files",
                column: "blikon_id");

            migrationBuilder.CreateIndex(
                name: "idx_files_core_folder",
                table: "files",
                column: "core_folder_id");

            migrationBuilder.CreateIndex(
                name: "IX_files_deleted_at",
                table: "files",
                column: "deleted_at",
                filter: "deleted_at IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "file_comments");

            migrationBuilder.DropTable(
                name: "files");
        }
    }
}
