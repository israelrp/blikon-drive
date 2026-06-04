"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FolderOpen, Plus, X, AlertCircle, Trash2, CheckSquare, CheckCircle2, Share2, Users } from "lucide-react";
import { DriveHeader } from "@/components/DriveHeader";
import { ShareDialog } from "@/components/ShareDialog";
import {
  ensureFolder, deleteFolder, batchDeleteFolders,
  getSharedWithMe, DriveFolder, SharedFolder,
} from "@/lib/api";

interface UserInfo {
  blikonId: string; cronoCode: string; profileName: string; email: string; photo: string; phoneNumber: string;
}

// Reglas: minúsculas, letras, números y guiones. Empieza con letra o número.
const FOLDER_RE = /^[a-z0-9][a-z0-9-]*$/;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")          // espacios → guión
    .replace(/[^a-z0-9-]/g, "")   // eliminar caracteres no permitidos
    .replace(/-+/g, "-")           // guiones múltiples → uno
    .replace(/^-|-$/g, "");        // quitar guiones al inicio/fin
}

function validateName(name: string): string | null {
  if (!name) return "El nombre es requerido";
  if (name.length < 2) return "Mínimo 2 caracteres";
  if (name.length > 50) return "Máximo 50 caracteres";
  if (!FOLDER_RE.test(name)) return "Solo minúsculas, números y guiones";
  return null;
}

export function HomeClient({
  folders: initial,
  userInfo,
}: {
  folders: DriveFolder[];
  userInfo: UserInfo;
}) {
  const router = useRouter();
  const [folders, setFolders] = useState(initial);
  const [view, setView]       = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState(false);
  const [input, setInput]     = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [shared, setShared]   = useState<SharedFolder[]>([]);
  const [shareTarget, setShareTarget] = useState<DriveFolder | null>(null);

  // Cargar folders compartidos conmigo (por mi teléfono)
  useEffect(() => {
    getSharedWithMe(userInfo.phoneNumber, userInfo.blikonId)
      .then(setShared)
      .catch(() => {});
  }, [userInfo.phoneNumber, userInfo.blikonId]);

  const slug = slugify(input);

  function handleInput(v: string) {
    setInput(v);
    setError(validateName(slugify(v)));
  }

  async function handleCreate() {
    const name = slug;
    const err = validateName(name);
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const folder = await ensureFolder(name, userInfo.blikonId);
      setFolders((prev) => prev.some((f) => f.id === folder.id) ? prev : [folder, ...prev]);
      setCreating(false);
      setInput("");
      router.push(`/folder/${name}`);
    } catch {
      setError("No se pudo crear el folder");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function selectAll() {
    setSelected(new Set(folders.map((f) => f.id)));
  }

  async function deleteOne(id: string) {
    await deleteFolder(id, userInfo.blikonId);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  async function handleBatchDelete() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await batchDeleteFolders(Array.from(selected), userInfo.blikonId);
      const ids = selected;
      setFolders((prev) => prev.filter((f) => !ids.has(f.id)));
      clearSelection();
    } finally {
      setDeleting(false);
    }
  }

  const hasSelection = selected.size > 0;

  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      <DriveHeader view={view} onViewChange={setView} userInfo={userInfo} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Título + botón nuevo */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-medium text-[#202124]">Mis folders</h1>
          <button
            onClick={() => { setCreating(true); setInput(""); setError(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-full hover:bg-[#1557b0] transition-colors"
          >
            <Plus size={15} />
            Nuevo folder
          </button>
        </div>

        {/* Barra de selección */}
        {hasSelection && (
          <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-[#e8f0fe] rounded-xl border border-[#1a73e8]/20">
            <span className="text-sm font-medium text-[#1a73e8]">
              {selected.size} carpeta{selected.size > 1 ? "s" : ""} seleccionada{selected.size > 1 ? "s" : ""}
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
                {deleting ? "Eliminando…" : `Eliminar ${selected.size}`}
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

        {/* Modal crear folder */}
        {creating && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium text-[#202124]">Nuevo folder</h2>
                <button onClick={() => setCreating(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f6f8fc]">
                  <X size={16} className="text-[#444746]" />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#444746]">Nombre del folder</label>
                <input
                  autoFocus
                  value={input}
                  onChange={(e) => handleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="mi-proyecto"
                  className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
                />
                {/* Preview del slug */}
                {slug && (
                  <p className="text-xs text-[#444746] mt-1">
                    URL: <span className="font-mono text-[#1a73e8]">drive-{userInfo.cronoCode}-{slug}.com.blog</span>
                  </p>
                )}
                {error && (
                  <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}
                <p className="text-xs text-[#9aa0a6] mt-1">
                  Solo minúsculas, números y guiones. Ej: <span className="font-mono">mi-proyecto</span>
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setCreating(false)}
                  className="px-4 py-2 text-sm text-[#444746] hover:bg-[#f6f8fc] rounded-full"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!slug || !!error || loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-full hover:bg-[#1557b0] disabled:opacity-40 transition-colors"
                >
                  {loading ? "Creando…" : "Crear"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de folders */}
        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#444746]">
            <FolderOpen size={64} strokeWidth={0.8} className="text-[#dadce0] mb-4" />
            <p className="font-medium text-[#202124]">Sin folders todavía</p>
            <p className="text-sm mt-1">Crea tu primer folder para empezar a guardar archivos</p>
            <button
              onClick={() => setCreating(true)}
              className="mt-4 px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-full hover:bg-[#1557b0]"
            >
              Crear folder
            </button>
          </div>
        ) : (
          <div className={view === "grid"
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
            : "flex flex-col gap-1"
          }>
            {folders.map((f) => (
              <RootFolderItem
                key={f.id}
                folder={f}
                view={view}
                cronoCode={userInfo.cronoCode}
                selected={selected.has(f.id)}
                onToggleSelect={toggleSelect}
                onDelete={deleteOne}
                onShare={setShareTarget}
              />
            ))}
          </div>
        )}

        {/* Compartidos conmigo */}
        {shared.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} className="text-[#1a73e8]" />
              <h2 className="text-lg font-medium text-[#202124]">Compartidos conmigo</h2>
            </div>
            <div className={view === "grid"
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
              : "flex flex-col gap-1"
            }>
              {shared.map((sf) => (
                <Link
                  key={sf.shareId}
                  href={`/folder/${sf.id}`}
                  className={view === "grid"
                    ? "flex flex-col rounded-xl border border-[#dadce0] bg-white hover:shadow-md transition-all overflow-hidden"
                    : "flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white transition-colors"
                  }
                >
                  {view === "grid" ? (
                    <>
                      <div className="h-28 bg-[#E8F0FE] flex items-end px-3 pb-1 relative">
                        <span className="absolute top-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/80 text-[#1a73e8]">
                          {sf.permission === "editor" ? "Editor" : "Lector"}
                        </span>
                        <svg viewBox="0 0 80 60" className="w-full" fill="none">
                          <rect x="0" y="12" width="80" height="48" rx="4" fill="#4285F4" />
                          <rect x="0" y="8" width="36" height="12" rx="3" fill="#4285F4" />
                        </svg>
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium text-[#202124] truncate">{sf.name || sf.id}</p>
                        <p className="text-xs text-[#9aa0a6] flex items-center gap-1 truncate">
                          <Share2 size={10} /> Compartido contigo
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <FolderOpen size={20} className="text-[#4285F4] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#202124] truncate">{sf.name || sf.id}</p>
                        <p className="text-xs text-[#9aa0a6] truncate">Compartido contigo · {sf.permission === "editor" ? "Editor" : "Lector"}</p>
                      </div>
                    </>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {shareTarget && (
        <ShareDialog
          folderId={shareTarget.id}
          folderName={shareTarget.name || shareTarget.id}
          blikonId={userInfo.blikonId}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}

function RootFolderItem({
  folder,
  view,
  cronoCode,
  selected,
  onToggleSelect,
  onDelete,
  onShare,
}: {
  folder: DriveFolder;
  view: "grid" | "list";
  cronoCode: string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onShare: (folder: DriveFolder) => void;
}) {
  const [hovered, setHovered]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos]   = useState({ x: 0, y: 0 });
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const showCheckbox = selected || hovered;

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  }

  function handleClick(e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onToggleSelect(folder.id);
    }
  }

  function handleCheckbox(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onToggleSelect(folder.id);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    setMenuOpen(false);
    setDeleting(true);
    try {
      await onDelete(folder.id);
    } finally {
      setDeleting(false);
    }
  }

  const url = `drive-${cronoCode}-${folder.id}.com.blog`;

  const contextMenu = menuOpen && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      <div
        ref={menuRef}
        className="fixed z-50 bg-white rounded-xl shadow-xl border border-[#dadce0] py-2 w-48"
        style={{ top: menuPos.y, left: menuPos.x }}
      >
        <button
          onClick={(e) => { e.preventDefault(); setMenuOpen(false); onShare(folder); }}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm text-[#202124] hover:bg-[#f6f8fc]"
        >
          <Share2 size={16} className="text-[#444746]" /> Compartir
        </button>
        <div className="border-t border-[#e8eaed] my-1" />
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 size={16} />
          {deleting ? "Eliminando…" : "Eliminar carpeta"}
        </button>
        <p className="px-4 pb-1 text-xs text-[#9aa0a6]">Se elimina con todo su contenido</p>
      </div>
    </>
  );

  const checkbox = (
    <div
      onClick={handleCheckbox}
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all shrink-0
        ${selected ? "bg-[#1a73e8] border-[#1a73e8]" : "bg-white border-[#9aa0a6]"}
        ${showCheckbox ? "opacity-100" : "opacity-0"}`}
    >
      {selected && <CheckCircle2 size={14} className="text-white" strokeWidth={3} />}
    </div>
  );

  if (view === "list") {
    return (
      <div
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={handleContextMenu}
      >
        <Link
          href={`/folder/${folder.id}`}
          onClick={handleClick}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors
            ${selected ? "bg-[#e8f0fe]" : "hover:bg-white"}`}
        >
          {checkbox}
          <FolderOpen size={20} className="text-[#F9AB00] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#202124] truncate">{folder.name || folder.id}</p>
            <p className="text-xs text-[#9aa0a6] font-mono truncate">{url}</p>
          </div>
        </Link>
        {contextMenu}
      </div>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={handleContextMenu}
    >
      <Link
        href={`/folder/${folder.id}`}
        onClick={handleClick}
        className={`flex flex-col rounded-xl border bg-white hover:shadow-md transition-all overflow-hidden
          ${selected ? "border-[#1a73e8] shadow-md" : "border-[#dadce0]"}`}
      >
        {/* Thumbnail folder */}
        <div className={`h-28 flex items-end px-3 pb-1 relative ${selected ? "bg-[#d2e3fc]" : "bg-[#FFF8E1]"}`}>
          <div className="absolute top-2 left-2 z-10">{checkbox}</div>
          <svg viewBox="0 0 80 60" className="w-full" fill="none">
            <rect x="0" y="12" width="80" height="48" rx="4" fill="#F9AB00" />
            <rect x="0" y="8" width="36" height="12" rx="3" fill="#F9AB00" />
          </svg>
        </div>
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-[#202124] truncate">{folder.name || folder.id}</p>
          <p className="text-xs text-[#9aa0a6] font-mono truncate">{url}</p>
        </div>
      </Link>
      {contextMenu}
    </div>
  );
}
