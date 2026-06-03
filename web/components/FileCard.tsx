"use client";

import Link from "next/link";
import { DriveFile } from "@/lib/api";
import { formatBytes, fileIcon } from "@/lib/utils";

export function FileCard({ file }: { file: DriveFile }) {
  return (
    <Link href={`/file/${file.id}`}>
      <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
        <span className="text-2xl shrink-0">{fileIcon(file.mimeType, file.extension)}</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">{file.title ?? file.name}</p>
          <p className="text-xs text-gray-500 truncate">{file.name}</p>
          <div className="flex gap-2 mt-1 flex-wrap">
            {file.tags.map((t) => (
              <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {t}
              </span>
            ))}
          </div>
        </div>
        <span className="text-xs text-gray-400 shrink-0">{formatBytes(file.sizeBytes)}</span>
      </div>
    </Link>
  );
}
