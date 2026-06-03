"use client";

import { useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { uploadFile } from "@/lib/api";

export function UploadButton({
  coreFolderId,
  onUploaded,
}: {
  coreFolderId: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      setFileName(file.name);
      setProgress(0);
      try {
        await uploadFile(coreFolderId, file, setProgress);
      } catch {
        // silently continue next file
      }
    }

    setUploading(false);
    setProgress(0);
    setFileName("");
    onUploaded();
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-3 pl-3 pr-6 py-3 bg-white rounded-2xl shadow-md hover:shadow-lg
          active:shadow-sm disabled:opacity-60 transition-all text-sm font-medium text-[#202124] w-full"
      >
        <div className="w-8 h-8 bg-[#f6f8fc] rounded-full flex items-center justify-center">
          {uploading ? (
            <Upload size={16} className="text-[#1a73e8] animate-bounce" />
          ) : (
            <Plus size={16} className="text-[#444746]" />
          )}
        </div>
        {uploading ? "Subiendo..." : "Nuevo"}
      </button>

      {/* Progress toast */}
      {uploading && (
        <div className="mx-2 bg-white rounded-xl shadow-lg p-3 text-xs">
          <p className="text-[#202124] font-medium truncate mb-1.5">{fileName}</p>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1a73e8] rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[#444746] mt-1">{progress}%</p>
        </div>
      )}
    </div>
  );
}
