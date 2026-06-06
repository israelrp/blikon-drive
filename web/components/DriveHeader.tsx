"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, LayoutGrid, List, Plus, Upload, LogOut, FolderPlus, FileUp, FolderUp, HardDrive } from "lucide-react";
import { BlikonDriveLogo } from "./BlikonDriveLogo";
import { uploadFolderFiles, getStorageUsage, StorageUsage } from "@/lib/api";
import { formatBytes } from "@/lib/utils";

interface UserInfo {
  profileName: string;
  email:       string;
  photo:       string;
  blikonId:    string;
  cronoCode:   string;
  phoneNumber?: string;
}

export function DriveHeader({
  view,
  onViewChange,
  coreFolderId,
  onUploaded,
  onNewFolder,
  userInfo,
  canUpload = true,
}: {
  view:          "grid" | "list";
  onViewChange:  (v: "grid" | "list") => void;
  coreFolderId?: string;
  onUploaded?:   () => void;
  onNewFolder?:  () => void;
  userInfo?:     UserInfo | null;
  canUpload?:    boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  useEffect(() => {
    if (!newMenuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setNewMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [newMenuOpen]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    // Búsqueda global por nombre en todos tus archivos (no se limita al folder actual).
    const params = new URLSearchParams({ q });
    router.push(`/search?${params}`);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length || !coreFolderId) return;
    const items = Array.from(files).map((f) => ({ file: f, relativePath: f.name }));
    setUploading(true);
    setProgress(0);
    try {
      await uploadFolderFiles(
        coreFolderId, items,
        (done, total) => setProgress(Math.round((done / total) * 100)),
        userInfo?.blikonId, userInfo?.phoneNumber,
      );
    } finally {
      setUploading(false);
      setProgress(0);
      onUploaded?.();
    }
  }

  // Subir una carpeta completa (input con webkitdirectory) — preserva estructura
  async function handleFolderUpload(files: FileList | null) {
    if (!files || !files.length || !coreFolderId) return;
    const items = Array.from(files).map((f) => ({
      file: f,
      relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
    }));
    setUploading(true);
    setProgress(0);
    try {
      await uploadFolderFiles(
        coreFolderId, items,
        (done, total) => setProgress(Math.round((done / total) * 100)),
        userInfo?.blikonId, userInfo?.phoneNumber,
      );
    } finally {
      setUploading(false);
      setProgress(0);
      onUploaded?.();
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="h-16 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 bg-[#f6f8fc] border-b border-[#e8eaed] sticky top-0 z-10">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      {/* Input para subir carpeta completa (webkitdirectory) */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error — webkitdirectory no está en los tipos de React
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={e => handleFolderUpload(e.target.files)}
      />

      {/* Logo — el texto se oculta en mobile para no desfasar el header */}
      <Link href="/" className="flex items-center gap-2 shrink-0 sm:mr-1">
        <BlikonDriveLogo size={32} />
        <span className="hidden md:inline text-xl text-[#444746] font-normal tracking-tight">
          Blikon <span className="font-medium text-[#202124]">Drive</span>
        </span>
      </Link>

      {/* Search */}
      <form
        onSubmit={handleSearch}
        className={`flex-1 min-w-0 max-w-2xl flex items-center gap-2 px-3 sm:px-4 h-11 rounded-full transition-all
          ${focused ? "bg-white shadow-md" : "bg-[#e9eef6] hover:bg-[#dde3ea]"}`}
      >
        <Search size={18} className="text-[#444746] shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Buscar en Drive"
          className="flex-1 bg-transparent outline-none text-sm text-[#202124] placeholder:text-[#444746]"
        />
        {q && (
          <button type="button" onClick={() => setQ("")}>
            <X size={16} className="text-[#444746]" />
          </button>
        )}
      </form>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* View toggle — oculto en mobile para ahorrar espacio */}
        <div className="hidden sm:flex items-center bg-[#e9eef6] rounded-full p-1 gap-0.5">
          <button
            onClick={() => onViewChange("list")}
            className={`p-1.5 rounded-full transition-colors ${view === "list" ? "bg-[#c2e7ff]" : "hover:bg-[#dde3ea]"}`}
            title="Vista tabla"
          >
            <List size={16} className="text-[#444746]" />
          </button>
          <button
            onClick={() => onViewChange("grid")}
            className={`p-1.5 rounded-full transition-colors ${view === "grid" ? "bg-[#c2e7ff]" : "hover:bg-[#dde3ea]"}`}
            title="Vista cuadrícula"
          >
            <LayoutGrid size={16} className="text-[#444746]" />
          </button>
        </div>

        {/* Botón Nuevo — menú con "Nueva carpeta" y "Subir archivos" */}
        {coreFolderId && canUpload && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setNewMenuOpen((o) => !o)}
              disabled={uploading}
              className="flex items-center gap-2 justify-center w-9 sm:w-auto sm:pl-4 sm:pr-5 h-9 bg-white text-[#202124] text-sm font-medium rounded-full shadow-md hover:shadow-lg active:shadow-sm disabled:opacity-60 transition-all border border-[#dadce0]"
            >
              {uploading ? (
                <>
                  <Upload size={15} className="text-[#1a73e8] animate-bounce shrink-0" />
                  <span className="hidden sm:inline text-[#1a73e8]">{progress}%</span>
                </>
              ) : (
                <>
                  <Plus size={15} className="text-[#444746] shrink-0" />
                  <span className="hidden sm:inline">Nuevo</span>
                </>
              )}
            </button>

            {newMenuOpen && !uploading && (
              <div className="absolute right-0 top-11 z-30 w-52 bg-white rounded-xl shadow-xl border border-[#dadce0] py-2">
                {onNewFolder && (
                  <button
                    onClick={() => { setNewMenuOpen(false); onNewFolder(); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#202124] hover:bg-[#f6f8fc]"
                  >
                    <FolderPlus size={17} className="text-[#444746]" /> Nueva carpeta
                  </button>
                )}
                <button
                  onClick={() => { setNewMenuOpen(false); inputRef.current?.click(); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#202124] hover:bg-[#f6f8fc]"
                >
                  <FileUp size={17} className="text-[#444746]" /> Subir archivos
                </button>
                <button
                  onClick={() => { setNewMenuOpen(false); folderInputRef.current?.click(); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#202124] hover:bg-[#f6f8fc]"
                >
                  <FolderUp size={17} className="text-[#444746]" /> Subir carpeta
                </button>
              </div>
            )}
          </div>
        )}

        {/* Avatar con menú */}
        <UserAvatar userInfo={userInfo} onLogout={handleLogout} />
      </div>
    </header>
  );
}

function UserAvatar({
  userInfo,
  onLogout,
}: {
  userInfo?: UserInfo | null;
  onLogout:  () => void;
}) {
  const [open, setOpen] = useState(false);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const initial = userInfo?.profileName?.[0]?.toUpperCase() ?? "B";

  // Cargar uso de espacio al abrir el menú
  useEffect(() => {
    if (open && userInfo) {
      getStorageUsage(userInfo.blikonId).then(setStorage).catch(() => {});
    }
  }, [open, userInfo]);

  const pct = storage && storage.quotaBytes > 0
    ? Math.min(100, Math.round((storage.usedBytes / storage.quotaBytes) * 100))
    : 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:ring-offset-1"
        title={userInfo ? `${userInfo.profileName} · ${userInfo.cronoCode}` : "Cuenta"}
      >
        {userInfo?.photo ? (
          <img src={userInfo.photo} alt={userInfo.profileName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#1a73e8] flex items-center justify-center text-white text-sm font-medium">
            {initial}
          </div>
        )}
      </button>

      {open && (
        <>
          {/* Overlay para cerrar */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-11 z-20 w-64 bg-white rounded-2xl shadow-xl border border-[#e8eaed] overflow-hidden">
            {userInfo && (
              <div className="px-4 py-3 border-b border-[#e8eaed]">
                <p className="text-sm font-medium text-[#202124] truncate">cel-{userInfo.phoneNumber}.com.blog</p>
                <p className="text-xs text-[#444746] truncate">{userInfo.email}</p>
                <p className="text-xs font-mono text-[#9aa0a6] mt-0.5 truncate">{userInfo.cronoCode}</p>
              </div>
            )}

            {/* Almacenamiento usado */}
            <div className="px-4 py-3 border-b border-[#e8eaed]">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive size={14} className="text-[#444746]" />
                <span className="text-xs font-medium text-[#444746]">Almacenamiento</span>
              </div>
              <div className="h-1.5 bg-[#e9eef6] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : "bg-[#1a73e8]"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-[#444746] mt-1.5">
                {storage
                  ? `${formatBytes(storage.usedBytes)} de ${formatBytes(storage.quotaBytes)} usados`
                  : "Calculando…"}
              </p>
            </div>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#202124] hover:bg-[#f6f8fc] transition-colors"
            >
              <LogOut size={15} className="text-[#444746]" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}
