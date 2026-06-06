"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getFileById, FileDetail } from "@/lib/api";
import { FileDetailClient } from "@/app/file/[id]/FileDetailClient";
import type { UserProfile } from "@/lib/auth";

// Detalle de archivo como overlay (no cambia la URL).
export function FileOverlay({
  fileId,
  session,
  onClose,
  onDeleted,
}: {
  fileId: string;
  session: UserProfile;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [file, setFile] = useState<FileDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFile(null);
    setError(false);
    getFileById(fileId)
      .then((f) => { if (!cancelled) setFile(f); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [fileId]);

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-[#f6f8fc]">
      {error ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-[#444746]">
          <p className="text-sm">No se pudo cargar el archivo.</p>
          <button onClick={onClose} className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-full hover:bg-[#1557b0]">Cerrar</button>
        </div>
      ) : !file ? (
        <div className="h-full flex items-center justify-center gap-2 text-[#9aa0a6]">
          <Loader2 size={18} className="animate-spin" /> <span className="text-sm">Cargando…</span>
        </div>
      ) : (
        <FileDetailClient
          file={file}
          folderId={file.coreFolderId}
          blikonId={session.blikonId}
          phoneNumber={session.phoneNumber}
          onClose={onClose}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
