using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlikonDrive.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFolderShares : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "folder_shares",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    folder_id = table.Column<string>(type: "text", nullable: false),
                    owner_blikon_id = table.Column<string>(type: "text", nullable: false),
                    phone_number = table.Column<string>(type: "text", nullable: false),
                    permission = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_folder_shares", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_folder_shares_folder_id_phone_number",
                table: "folder_shares",
                columns: new[] { "folder_id", "phone_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_folder_shares_phone_number",
                table: "folder_shares",
                column: "phone_number");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "folder_shares");
        }
    }
}
