"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { DriveHeader } from "@/components/DriveHeader";
import { FileGridItem } from "@/components/FileGridItem";
import { FileTableView } from "@/components/FileTableView";
import { FolderCard } from "@/components/FolderCard";
import { DropZone } from "@/components/DropZone";
import { getFilesByFolder, getFolderChildren, batchDeleteFiles, DriveFile, DriveFolder } from "@/lib/api";
import { FolderOpen, ChevronRight, Trash2, X, CheckSquare } from "lucide-react";

interface UserInfo {
  blikonId: string; profileName: string; email: string; photo: string;
}

export function FolderClient({
  folderId,
  initialFiles,
  initialSubfolders,
  breadcrumb,
  userInfo,
}: {
  folderId:          string;
  initialFiles:      DriveFile[];
  initialSubfolders: DriveFolder[];
  breadcrumb:        { id: string; name: string }[];
  userInfo?:         UserInfo | null;
}) {
  const [files, setFiles] = useState(initialFiles);
  const [subfolders, setSubfolders] = useState(initialSubfolders);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    const [f, sf] = await Promise.all([
      getFilesByFolder(folderId),
      getFolderChildren(folderId),
    ]);
    setFiles(f);
    setSubfolders(sf);
  }, [folderId]);

  // SSE — escucha eventos del servidor para actualizaciones en tiempo real
  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5086";
    const url = `${api}/api/events/files?coreFolderId=${encodeURIComponent(folderId)}`;
    const source = new EventSource(url);

    source.onmessage = () => { refresh(); };
    source.onerror   = () => { /* reconecta automáticamente */ };

    return () => source.close();
  }, [folderId, refresh]);

  function handleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(files.map((f) => f.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleBatchDelete() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await batchDeleteFiles(Array.from(selected));
      setSelected(new Set());
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  const isEmpty = files.length === 0 && subfolders.length === 0;
  const hasSelection = selected.size > 0;

  return (
    <div className="flex flex-col h-screen bg-[#f6f8fc]">
      <DriveHeader view={view} onViewChange={setView} coreFolderId={folderId} onUploaded={refresh} userInfo={userInfo} />

      <div className="flex flex-1 min-h-0">
        <DropZone coreFolderId={folderId} onUploaded={refresh}>
          <main className="flex-1 overflow-y-auto px-6 py-4">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 mb-4 text-sm text-[#444746] flex-wrap">
              <Link href="/" className="hover:text-[#1a73e8] transition-colors">Mi Drive</Link>
              {breadcrumb.map((crumb) => (
                <span key={crumb.id} className="flex items-center gap-1">
                  <ChevronRight size={14} className="text-[#9aa0a6]" />
                  <Link
                    href={`/folder/${crumb.id}`}
                    className="hover:text-[#1a73e8] transition-colors font-medium last:text-[#202124] last:pointer-events-none"
                  >
                    {crumb.name}
                  </Link>
                </span>
              ))}
            </nav>

            {/* Barra de selección */}
            {hasSelection && (
              <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-[#e8f0fe] rounded-xl border border-[#1a73e8]/20">
                <span className="text-sm font-medium text-[#1a73e8]">
                  {selected.size} seleccionado{selected.size > 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={selectAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#444746] hover:bg-[#d2e3fc] rounded-full transition-colors"
                  >
                    <CheckSquare size={14} /> Todos
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white hover:bg-red-50 rounded-full border border-red-200 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {deleting ? "Eliminando..." : `Eliminar ${selected.size}`}
                  </button>
                  <button
                    onClick={clearSelection}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#d2e3fc] transition-colors"
                  >
                    <X size={15} className="text-[#444746]" />
                  </button>
                </div>
              </div>
            )}

            {isEmpty ? (
              <div className="flex flex-col items-center justify-center h-80 gap-4 text-[#444746]">
                <FolderOpen size={72} strokeWidth={0.8} className="text-[#dadce0]" />
                <div className="text-center">
                  <p className="text-base font-medium text-[#202124]">Esta carpeta está vacía</p>
                  <p className="text-sm mt-1">Suelta archivos aquí o usa el botón "Nuevo"</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {subfolders.length > 0 && (
                  <section>
                    <p className="text-xs font-medium text-[#444746] uppercase tracking-wide mb-2">Carpetas</p>
                    {view === "grid" ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {subfolders.map((sf) => (
                          <FolderCard key={sf.id} folder={sf} view="grid" />
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-[#dadce0] overflow-hidden">
                        {subfolders.map((sf) => (
                          <FolderCard key={sf.id} folder={sf} view="list" />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {files.length > 0 && (
                  <section>
                    {subfolders.length > 0 && (
                      <p className="text-xs font-medium text-[#444746] uppercase tracking-wide mb-2">Archivos</p>
                    )}
                    {view === "grid" ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {files.map((f) => (
                          <FileGridItem
                            key={f.id}
                            file={f}
                            selected={selected.has(f.id)}
                            onSelect={handleSelect}
                            onDeleted={refresh}
                          />
                        ))}
                      </div>
                    ) : (
                      <FileTableView
                        files={files}
                        selected={selected}
                        onSelect={handleSelect}
                        onDeleted={refresh}
                      />
                    )}
                  </section>
                )}
              </div>
            )}
          </main>
        </DropZone>
      </div>
    </div>
  );
}
