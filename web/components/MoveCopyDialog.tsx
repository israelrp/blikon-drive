"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Folder, ChevronRight, Loader2, FolderInput, Copy, Home } from "lucide-react";
import {
  getFolderChildren, getSharedWithMe,
  moveFile, copyFile, batchMoveFiles, batchCopyFiles,
  DriveFolder,
} from "@/lib/api";

interface Crumb { id: string | null; name: string; }

export function MoveCopyDialog({
  mode,
  fileIds,
  sourceFolderId,
  blikonId,
  phoneNumber,
  onClose,
  onDone,
}: {
  mode: "move" | "copy";
  fileIds: string[];
  sourceFolderId: string;
  blikonId?: string;
  phoneNumber?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [stack, setStack]   = useState<Crumb[]>([{ id: null, name: "Mi Drive" }]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const current = stack[stack.length - 1];
  const currentId = current.id;

  const loadFolders = useCallback(async () => {
    setLoading(true);
    try {
      if (currentId === null) {
        // Raíz: folders propios + compartidos como editor
        const [own, shared] = await Promise.all([
          getFolderChildren(undefined, blikonId, phoneNumber).catch(() => []),
          getSharedWithMe(phoneNumber, blikonId).catch(() => []),
        ]);
        const sharedEditable = shared
          .filter((s) => s.permission === "editor")
          .map((s) => ({ id: s.id, name: s.name, parentId: null, createdAt: s.createdAt, childCount: s.childCount, fileCount: s.fileCount } as DriveFolder));
        // evitar duplicados si un folder propio también aparece compartido
        const ids = new Set(own.map((f) => f.id));
        setFolders([...own, ...sharedEditable.filter((f) => !ids.has(f.id))]);
      } else {
        setFolders(await getFolderChildren(currentId, blikonId, phoneNumber).catch(() => []));
      }
    } finally {
      setLoading(false);
    }
  }, [currentId, blikonId, phoneNumber]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  function enter(f: DriveFolder) {
    setStack((s) => [...s, { id: f.id, name: f.name || f.id }]);
  }
  function goTo(index: number) {
    setStack((s) => s.slice(0, index + 1));
  }

  const isSource    = currentId === sourceFolderId;
  const canAct      = currentId !== null && !isSource && !busy;
  const actLabel    = mode === "move" ? "Mover aquí" : "Copiar aquí";

  async function handleAction() {
    if (!canAct || currentId === null) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "move") {
        if (fileIds.length === 1) await moveFile(fileIds[0], currentId, blikonId, phoneNumber);
        else await batchMoveFiles(fileIds, currentId, blikonId, phoneNumber);
      } else {
        if (fileIds.length === 1) await copyFile(fileIds[0], currentId, blikonId, phoneNumber);
        else await batchCopyFiles(fileIds, currentId, blikonId, phoneNumber);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-base font-medium text-[#202124] flex items-center gap-2">
            {mode === "move" ? <FolderInput size={18} className="text-[#1a73e8]" /> : <Copy size={18} className="text-[#1a73e8]" />}
            {mode === "move" ? "Mover" : "Copiar"} {fileIds.length} archivo{fileIds.length > 1 ? "s" : ""}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f6f8fc]">
            <X size={16} className="text-[#444746]" />
          </button>
        </div>

        {/* Breadcrumb de navegación */}
        <div className="px-6 flex items-center gap-1 text-sm text-[#444746] flex-wrap mb-2">
          {stack.map((c, i) => (
            <span key={`${c.id}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={13} className="text-[#9aa0a6]" />}
              <button
                onClick={() => goTo(i)}
                className={`hover:text-[#1a73e8] hover:underline ${i === stack.length - 1 ? "font-medium text-[#202124]" : ""}`}
              >
                {i === 0 ? <span className="flex items-center gap-1"><Home size={12} /> {c.name}</span> : c.name}
              </button>
            </span>
          ))}
        </div>

        {/* Lista de folders */}
        <div className="flex-1 overflow-y-auto px-3 min-h-[180px]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 h-40 text-[#9aa0a6]">
              <Loader2 size={16} className="animate-spin" /> <span className="text-sm">Cargando…</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-[#9aa0a6]">Sin subcarpetas</div>
          ) : (
            folders.map((f) => (
              <button
                key={f.id}
                onClick={() => enter(f)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-[#f6f8fc] text-left"
              >
                <Folder size={18} className="text-[#F9AB00] shrink-0" fill="#FFF0C2" />
                <span className="flex-1 text-sm text-[#202124] truncate">{f.name || f.id}</span>
                <ChevronRight size={15} className="text-[#9aa0a6] shrink-0" />
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e8eaed] flex items-center gap-2">
          {error && <p className="text-xs text-red-500 flex-1 truncate">{error}</p>}
          {!error && isSource && currentId !== null && (
            <p className="text-xs text-[#9aa0a6] flex-1">El archivo ya está aquí</p>
          )}
          {!error && currentId === null && (
            <p className="text-xs text-[#9aa0a6] flex-1">Entra a una carpeta destino</p>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#444746] hover:bg-[#f6f8fc] rounded-full">Cancelar</button>
          <button
            onClick={handleAction}
            disabled={!canAct}
            className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-full hover:bg-[#1557b0] disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {actLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
