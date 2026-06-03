"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, LayoutGrid, List, Plus, Upload, LogOut } from "lucide-react";
import { BlikonDriveLogo } from "./BlikonDriveLogo";
import { uploadFile } from "@/lib/api";

interface UserInfo {
  profileName: string;
  email:       string;
  photo:       string;
  blikonId:    string;
  cronoCode:   string;
}

export function DriveHeader({
  view,
  onViewChange,
  coreFolderId,
  onUploaded,
  userInfo,
}: {
  view:          "grid" | "list";
  onViewChange:  (v: "grid" | "list") => void;
  coreFolderId?: string;
  onUploaded?:   () => void;
  userInfo?:     UserInfo | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    const params = new URLSearchParams({ q });
    if (coreFolderId) params.set("folder", coreFolderId);
    router.push(`/search?${params}`);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !coreFolderId) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      setProgress(0);
      await uploadFile(coreFolderId, file, setProgress, userInfo?.blikonId).catch(() => {});
    }
    setUploading(false);
    setProgress(0);
    onUploaded?.();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="h-16 flex items-center gap-3 px-5 bg-[#f6f8fc] border-b border-[#e8eaed] sticky top-0 z-10">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0 mr-1">
        <BlikonDriveLogo size={32} />
        <span className="text-xl text-[#444746] font-normal tracking-tight">
          Blikon <span className="font-medium text-[#202124]">Drive</span>
        </span>
      </Link>

      {/* Search */}
      <form
        onSubmit={handleSearch}
        className={`flex-1 max-w-2xl flex items-center gap-2 px-4 h-11 rounded-full transition-all
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
      <div className="ml-auto flex items-center gap-2">
        {/* View toggle */}
        <div className="flex items-center bg-[#e9eef6] rounded-full p-1 gap-0.5">
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

        {/* Botón Nuevo — solo cuando hay un folder activo */}
        {coreFolderId && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 pl-4 pr-5 h-9 bg-white text-[#202124] text-sm font-medium rounded-full shadow-md hover:shadow-lg active:shadow-sm disabled:opacity-60 transition-all border border-[#dadce0]"
          >
            {uploading ? (
              <>
                <Upload size={15} className="text-[#1a73e8] animate-bounce shrink-0" />
                <span className="text-[#1a73e8]">{progress}%</span>
              </>
            ) : (
              <>
                <Plus size={15} className="text-[#444746] shrink-0" />
                <span>Nuevo</span>
              </>
            )}
          </button>
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
  const initial = userInfo?.profileName?.[0]?.toUpperCase() ?? "B";

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
                <p className="text-sm font-medium text-[#202124] truncate">{userInfo.profileName}</p>
                <p className="text-xs text-[#444746] truncate">{userInfo.email}</p>
                <p className="text-xs font-mono text-[#9aa0a6] mt-0.5 truncate">{userInfo.cronoCode}</p>
              </div>
            )}
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
