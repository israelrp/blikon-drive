"use client";

import { useEffect, useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { uploadFile } from "@/lib/api";

export function DropZone({
  coreFolderId,
  onUploaded,
  children,
  cronoCode,
}: {
  coreFolderId: string;
  onUploaded: () => void;
  children: React.ReactNode;
  cronoCode?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (!(e.relatedTarget instanceof Node)) setDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length) return;

    setUploading(true);
    for (const file of files) {
      await uploadFile(coreFolderId, file, setProgress, cronoCode);
    }
    setUploading(false);
    setProgress(0);
    onUploaded();
  }, [coreFolderId, onUploaded, cronoCode]);

  useEffect(() => {
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleDragOver, handleDragLeave, handleDrop]);

  return (
    <div className="relative flex-1 min-h-0">
      {children}

      {/* Drag overlay */}
      {dragging && (
        <div className="absolute inset-0 z-50 bg-[#e8f0fe] border-4 border-dashed border-[#1a73e8] rounded-2xl flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-[#1a73e8] flex items-center justify-center">
            <Upload size={36} className="text-white" />
          </div>
          <p className="text-xl font-medium text-[#1a73e8]">Suelta para subir a este folder</p>
        </div>
      )}

      {/* Upload progress toast */}
      {uploading && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl border border-[#dadce0] px-6 py-4 flex items-center gap-4 min-w-72">
          <Upload size={20} className="text-[#1a73e8] shrink-0 animate-bounce" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#202124] mb-1.5">Subiendo archivos…</p>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1a73e8] rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-sm text-[#444746] shrink-0">{progress}%</span>
        </div>
      )}
    </div>
  );
}
