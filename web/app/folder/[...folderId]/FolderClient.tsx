"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { DriveHeader } from "@/components/DriveHeader";
import { FileGridItem } from "@/components/FileGridItem";
import { FileTableView } from "@/components/FileTableView";
import { FolderCard } from "@/components/FolderCard";
import { DropZone } from "@/components/DropZone";
import {
  getFilesByFolder, getFolderChildren, getFolderBreadcrumb, ensureFolder, getFolderAccess,
  batchDeleteFiles, batchDeleteFolders,
  DriveFile, DriveFolder,
} from "@/lib/api";
import { FolderOpen, ChevronRight, Trash2, X, CheckSquare, FolderPlus, AlertCircle } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";

interface UserInfo {
  blikonId: string; cronoCode: string; profileName: string; email: string; photo: string; phoneNumber: string;
}

const FOLDER_RE = /^[a-z0-9][a-z0-9-]*$/;
function slugify(v: string) {
  return v.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function FolderClient({
  folderId,
  userInfo,
}: {
  folderId:  string;
  userInfo?: UserInfo | null;
}) {
  const confirm = useConfirm();
  const [files, setFiles]           = useState<DriveFile[]>([]);
  const [subfolders, setSubfolders] = useState<DriveFolder[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [canWrite, setCanWrite]     = useState(true);   // permiso de escritura en este folder
  const [isShared, setIsShared]     = useState(false);  // folder compartido (no propio)
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName]   = useState("");
  const [creatingError, setCreatingError]   = useState<string | null>(null);
  const [creatingBusy, setCreatingBusy]     = useState(false);
  const [view, setView]             = useState<"grid" | "list">("grid");
  const [selectedFiles, setSelectedFiles]     = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [deleting, setDeleting]     = useState(false);

  // En mobile, por defecto vista de lista (tabla) — se ve el nombre completo.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) setView("list");
  }, []);

  const refresh = useCallback(async () => {
    const [f, sf] = await Promise.all([
      getFilesByFolder(folderId, userInfo?.blikonId, userInfo?.phoneNumber),
      getFolderChildren(folderId, userInfo?.blikonId, userInfo?.phoneNumber),
    ]);
    setFiles(f);
    setSubfolders(sf);
  }, [folderId, userInfo?.blikonId, userInfo?.phoneNumber]);

  // Carga inicial client-side — la navegación es instantánea y los datos llegan después.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Reset al cambiar de folder para no mostrar contenido viejo
    setFiles([]);
    setSubfolders([]);
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());

    (async () => {
      // ensureFolder en paralelo — no bloquea la carga de datos
      ensureFolder(folderId, userInfo?.blikonId, undefined, userInfo?.phoneNumber).catch(() => {});
      const [f, sf, bc, access] = await Promise.all([
        getFilesByFolder(folderId, userInfo?.blikonId, userInfo?.phoneNumber).catch(() => []),
        getFolderChildren(folderId, userInfo?.blikonId, userInfo?.phoneNumber).catch(() => []),
        getFolderBreadcrumb(folderId, userInfo?.blikonId, userInfo?.phoneNumber).catch(() => []),
        getFolderAccess(folderId, userInfo?.blikonId, userInfo?.phoneNumber).catch(() => ({ canWrite: true, isShared: false })),
      ]);
      if (cancelled) return;
      setFiles(f);
      setSubfolders(sf);
      setBreadcrumb(bc);
      setCanWrite(access.canWrite);
      setIsShared(access.isShared);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [folderId, userInfo?.blikonId, userInfo?.phoneNumber]);

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5086";
    const url = `${api}/api/events/files?coreFolderId=${encodeURIComponent(folderId)}`;
    const source = new EventSource(url);
    source.onmessage = () => { refresh(); };
    return () => source.close();
  }, [folderId, refresh]);

  function handleSelectFile(id: string) {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSelectFolder(id: string) {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedFiles(new Set(files.map((f) => f.id)));
    setSelectedFolders(new Set(subfolders.map((sf) => sf.id)));
  }

  function clearSelection() {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  }

  const totalSelected = selectedFiles.size + selectedFolders.size;
  const hasSelection  = totalSelected > 0;

  async function handleBatchDelete() {
    if (!hasSelection) return;
    const partes = [
      selectedFolders.size > 0 ? `${selectedFolders.size} carpeta${selectedFolders.size > 1 ? "s" : ""}` : "",
      selectedFiles.size   > 0 ? `${selectedFiles.size} archivo${selectedFiles.size > 1 ? "s" : ""}` : "",
    ].filter(Boolean).join(" y ");
    const aviso = selectedFolders.size > 0 ? " Las carpetas se eliminan con su contenido." : "";
    const ok = await confirm({ title: "Eliminar elementos", message: `¿Eliminar ${partes}?${aviso}` });
    if (!ok) return;
    setDeleting(true);
    try {
      await Promise.all([
        selectedFiles.size   > 0 ? batchDeleteFiles(Array.from(selectedFiles), userInfo?.blikonId, userInfo?.phoneNumber)   : Promise.resolve(),
        selectedFolders.size > 0 ? batchDeleteFolders(Array.from(selectedFolders), userInfo?.blikonId, userInfo?.phoneNumber) : Promise.resolve(),
      ]);
      clearSelection();
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  const newFolderSlug = slugify(newFolderName);

  async function handleCreateFolder() {
    const slug = newFolderSlug;
    if (slug.length < 2 || !FOLDER_RE.test(slug)) {
      setCreatingError("Solo minúsculas, números y guiones (mín. 2)");
      return;
    }
    setCreatingBusy(true);
    setCreatingError(null);
    try {
      // Crea el subfolder bajo el folder actual (parentId = folderId).
      await ensureFolder(slug, userInfo?.blikonId, folderId, userInfo?.phoneNumber);
      setCreatingFolder(false);
      setNewFolderName("");
      await refresh();
    } catch {
      setCreatingError("No se pudo crear la carpeta");
    } finally {
      setCreatingBusy(false);
    }
  }

  const isEmpty = files.length === 0 && subfolders.length === 0;

  return (
    <div className="flex flex-col h-screen bg-[#f6f8fc]">
      <DriveHeader
        view={view}
        onViewChange={setView}
        coreFolderId={folderId}
        onUploaded={refresh}
        onNewFolder={() => { setNewFolderName(""); setCreatingError(null); setCreatingFolder(true); }}
        userInfo={userInfo}
        canUpload={canWrite}
      />

      <div className="flex flex-1 min-h-0">
        <DropZone coreFolderId={folderId} onUploaded={refresh} blikonId={userInfo?.blikonId} phoneNumber={userInfo?.phoneNumber} disabled={!canWrite}>
          <main className="flex-1 min-w-0 overflow-y-auto px-3 sm:px-6 py-4">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 mb-4 text-sm text-[#444746] flex-wrap">
              <Link href="/" className="hover:text-[#1a73e8] transition-colors">Mi Drive</Link>
              {breadcrumb.map((crumb, i) => {
                const isCurrent = i === breadcrumb.length - 1;
                return (
                  <span key={crumb.id} className="flex items-center gap-1">
                    <ChevronRight size={14} className="text-[#9aa0a6]" />
                    {isCurrent ? (
                      <span className="font-medium text-[#202124]">{crumb.name}</span>
                    ) : (
                      <Link
                        href={`/folder/${crumb.id}`}
                        className="hover:text-[#1a73e8] hover:underline transition-colors font-medium"
                      >
                        {crumb.name}
                      </Link>
                    )}
                  </span>
                );
              })}
              {isShared && (
                <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${canWrite ? "bg-[#e6f4ea] text-[#137333]" : "bg-[#fef7e0] text-[#b06000]"}`}>
                  {canWrite ? "Compartido · Editor" : "Compartido · Solo lectura"}
                </span>
              )}
            </nav>

            {/* Barra de selección */}
            {hasSelection && (
              <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-[#e8f0fe] rounded-xl border border-[#1a73e8]/20">
                <span className="text-sm font-medium text-[#1a73e8]">
                  {totalSelected} elemento{totalSelected > 1 ? "s" : ""} seleccionado{totalSelected > 1 ? "s" : ""}
                  {selectedFolders.size > 0 && selectedFiles.size > 0 && (
                    <span className="font-normal text-xs ml-1 text-[#5f6368]">
                      ({selectedFolders.size} carpeta{selectedFolders.size > 1 ? "s" : ""}, {selectedFiles.size} archivo{selectedFiles.size > 1 ? "s" : ""})
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={selectAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#444746] hover:bg-[#d2e3fc] rounded-full transition-colors"
                  >
                    <CheckSquare size={14} /> Todos
                  </button>
                  {canWrite && (
                    <button
                      onClick={handleBatchDelete}
                      disabled={deleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white hover:bg-red-50 rounded-full border border-red-200 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      {deleting ? "Eliminando…" : `Eliminar ${totalSelected}`}
                    </button>
                  )}
                  <button
                    onClick={clearSelection}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#d2e3fc] transition-colors"
                  >
                    <X size={15} className="text-[#444746]" />
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <FolderSkeleton view={view} />
            ) : isEmpty ? (
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
                          <FolderCard
                            key={sf.id}
                            folder={sf}
                            view="grid"
                            selected={selectedFolders.has(sf.id)}
                            onSelect={handleSelectFolder}
                            onDeleted={refresh}
                            blikonId={userInfo?.blikonId}
                            phoneNumber={userInfo?.phoneNumber}
                            canWrite={canWrite}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-[#dadce0] overflow-hidden">
                        {subfolders.map((sf) => (
                          <FolderCard
                            key={sf.id}
                            folder={sf}
                            view="list"
                            selected={selectedFolders.has(sf.id)}
                            onSelect={handleSelectFolder}
                            onDeleted={refresh}
                            blikonId={userInfo?.blikonId}
                            phoneNumber={userInfo?.phoneNumber}
                            canWrite={canWrite}
                          />
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
                            selected={selectedFiles.has(f.id)}
                            onSelect={handleSelectFile}
                            onDeleted={refresh}
                            canWrite={canWrite}
                            blikonId={userInfo?.blikonId}
                            phoneNumber={userInfo?.phoneNumber}
                          />
                        ))}
                      </div>
                    ) : (
                      <FileTableView
                        files={files}
                        selected={selectedFiles}
                        onSelect={handleSelectFile}
                        onDeleted={refresh}
                        canWrite={canWrite}
                        blikonId={userInfo?.blikonId}
                        phoneNumber={userInfo?.phoneNumber}
                      />
                    )}
                  </section>
                )}
              </div>
            )}
          </main>
        </DropZone>
      </div>

      {/* Modal — Nueva carpeta dentro de este folder */}
      {creatingFolder && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setCreatingFolder(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-[#202124] flex items-center gap-2">
                <FolderPlus size={18} className="text-[#1a73e8]" /> Nueva carpeta
              </h2>
              <button onClick={() => setCreatingFolder(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f6f8fc]">
                <X size={16} className="text-[#444746]" />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#444746]">Nombre de la carpeta</label>
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => { setNewFolderName(e.target.value); setCreatingError(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                placeholder="mi-subcarpeta"
                className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              />
              {newFolderSlug && (
                <p className="text-xs text-[#9aa0a6] mt-1 font-mono truncate">{folderId}/{newFolderSlug}</p>
              )}
              {creatingError && (
                <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                  <AlertCircle size={12} /> {creatingError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setCreatingFolder(false)} className="px-4 py-2 text-sm text-[#444746] hover:bg-[#f6f8fc] rounded-full">
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderSlug || creatingBusy}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-full hover:bg-[#1557b0] disabled:opacity-40 transition-colors"
              >
                {creatingBusy ? "Creando…" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FolderSkeleton({ view }: { view: "grid" | "list" }) {
  const placeholders = Array.from({ length: 12 });
  if (view === "list") {
    return (
      <div className="bg-white rounded-xl border border-[#dadce0] overflow-hidden animate-pulse">
        {placeholders.map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[#f0f0f0] last:border-0">
            <div className="w-8 h-8 rounded bg-[#eef1f5] shrink-0" />
            <div className="h-3 bg-[#eef1f5] rounded flex-1 max-w-[40%]" />
            <div className="h-3 bg-[#eef1f5] rounded w-24 ml-auto" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 animate-pulse">
      {placeholders.map((_, i) => (
        <div key={i} className="rounded-xl border border-[#dadce0] bg-white overflow-hidden">
          <div className="h-36 bg-[#eef1f5]" />
          <div className="px-3 py-2.5 flex flex-col gap-2">
            <div className="h-3 bg-[#eef1f5] rounded w-3/4" />
            <div className="h-2.5 bg-[#eef1f5] rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
