"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Search, SearchX, Loader2 } from "lucide-react";
import { searchFiles, DriveFile } from "@/lib/api";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { formatBytes } from "@/lib/utils";
import { useNav } from "@/app/NavContext";
import type { UserProfile } from "@/lib/auth";

// Búsqueda como overlay (no cambia la URL). Click en resultado → abre el archivo;
// click en la ubicación → navega a la carpeta.
export function SearchOverlay({
  query,
  session,
  onClose,
}: {
  query: string;
  session: UserProfile;
  onClose: () => void;
}) {
  const { openFile, openFolder } = useNav();
  const [results, setResults] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchFiles(query, undefined, session.blikonId)
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, session.blikonId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[55] bg-[#f6f8fc] flex flex-col">
      {/* Header */}
      <header className="h-16 flex items-center gap-3 px-4 bg-[#f6f8fc] border-b border-[#dadce0] shrink-0">
        <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#e9eef6]" title="Cerrar">
          <ArrowLeft size={20} className="text-[#444746]" />
        </button>
        <div className="min-w-0">
          <h2 className="text-base font-medium text-[#202124] truncate">Resultados para “{query}”</h2>
          {!loading && (
            <p className="text-xs text-[#444746]">
              {results.length} {results.length === 1 ? "archivo" : "archivos"}
            </p>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-5xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center gap-2 h-40 text-[#9aa0a6]">
            <Loader2 size={18} className="animate-spin" /> <span className="text-sm">Buscando…</span>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-[#444746]">
            <SearchX size={56} strokeWidth={0.8} className="text-[#dadce0]" />
            <div className="text-center">
              <p className="font-medium text-[#202124]">Sin resultados para “{query}”</p>
              <p className="text-sm mt-1">Prueba con el nombre del archivo, extensión o tipo</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#dadce0] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[#dadce0] text-xs font-medium text-[#444746] uppercase tracking-wide">
              <div className="w-8" />
              <p className="flex-1">Nombre</p>
              <p className="w-36 hidden md:block">Ubicación</p>
              <p className="w-24 text-right">Tamaño</p>
            </div>
            {results.map((f) => {
              const folderName = f.coreFolderId.split("/").pop() ?? f.coreFolderId;
              return (
                <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f6f8fc] transition-colors border-b border-[#f0f0f0] last:border-0">
                  <button onClick={() => openFile(f.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <FileTypeIcon extension={f.extension} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#202124] font-medium truncate">{f.title ?? f.name}</p>
                      {f.title && <p className="text-xs text-[#444746] truncate">{f.name}</p>}
                    </div>
                  </button>
                  <button
                    onClick={() => openFolder(f.coreFolderId)}
                    className="w-36 hidden md:flex items-center gap-1 text-xs text-[#1a73e8] hover:underline truncate shrink-0"
                    title={f.coreFolderId}
                  >
                    <span className="truncate">{folderName}</span>
                  </button>
                  <button onClick={() => openFile(f.id)} className="w-24 text-sm text-[#444746] text-right shrink-0">
                    {formatBytes(f.sizeBytes)}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {!loading && query.trim() === "" && (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-[#9aa0a6]">
            <Search size={40} strokeWidth={0.8} className="text-[#dadce0]" />
            <p className="text-sm">Escribe algo para buscar</p>
          </div>
        )}
      </main>
    </div>
  );
}
