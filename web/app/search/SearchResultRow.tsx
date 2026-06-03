"use client";

import Link from "next/link";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { formatBytes } from "@/lib/utils";
import { DriveFile } from "@/lib/api";

export function SearchResultRow({ file }: { file: DriveFile }) {
  const folderName = file.coreFolderId.split("/").pop() ?? file.coreFolderId;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f6f8fc] transition-colors border-b border-[#f0f0f0] last:border-0">
      <Link href={`/file/${file.id}`} className="contents">
        <FileTypeIcon extension={file.extension} size="sm" />

        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#202124] font-medium truncate">
            {file.title ?? file.name}
          </p>
          {file.title && (
            <p className="text-xs text-[#444746] truncate">{file.name}</p>
          )}
        </div>
      </Link>

      {/* Folder de origen — link independiente */}
      <Link
        href={`/folder/${file.coreFolderId}`}
        className="w-36 hidden md:flex items-center gap-1 text-xs text-[#1a73e8] hover:underline truncate shrink-0"
        title={file.coreFolderId}
      >
        <span className="truncate">{folderName}</span>
      </Link>

      <Link href={`/file/${file.id}`} className="w-20 text-xs text-[#444746] hidden sm:block shrink-0">
        {file.extension ? `.${file.extension}` : file.mimeType?.split("/")[1] ?? "—"}
      </Link>

      <Link href={`/file/${file.id}`} className="w-24 text-sm text-[#444746] text-right shrink-0">
        {formatBytes(file.sizeBytes)}
      </Link>
    </div>
  );
}
