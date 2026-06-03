"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Folder, MoreVertical, Trash2, CheckCircle2 } from "lucide-react";
import { DriveFolder, deleteFolder } from "@/lib/api";

export function FolderCard({
  folder,
  view = "grid",
  selected = false,
  onSelect,
  onDeleted,
  blikonId,
}: {
  folder:    DriveFolder;
  view?:     "grid" | "list";
  selected?: boolean;
  onSelect?: (id: string) => void;
  onDeleted?: () => void;
  blikonId?: string;
}) {
  const [hovered, setHovered]     = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [menuPos, setMenuPos]     = useState({ x: 0, y: 0 });
  const [deleting, setDeleting]   = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const showCheckbox = selected || hovered;

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function openMenu(x: number, y: number) {
    setMenuPos({ x, y });
    setMenuOpen(true);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    openMenu(e.clientX, e.clientY);
  }

  function handleMenuButton(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu(rect.left, rect.bottom + 4);
  }

  function handleClick(e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onSelect?.(folder.id);
    }
  }

  function handleCheckbox(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(folder.id);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    setMenuOpen(false);
    setDeleting(true);
    try {
      await deleteFolder(folder.id, blikonId);
      onDeleted?.();
    } finally {
      setDeleting(false);
    }
  }

  const meta = [
    folder.childCount > 0 && `${folder.childCount} carpeta${folder.childCount > 1 ? "s" : ""}`,
    folder.fileCount  > 0 && `${folder.fileCount} archivo${folder.fileCount > 1 ? "s" : ""}`,
  ].filter(Boolean).join(" · ");

  const contextMenu = menuOpen && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      <div
        ref={menuRef}
        className="fixed z-50 bg-white rounded-xl shadow-xl border border-[#dadce0] py-2 w-44"
        style={{ top: menuPos.y, left: menuPos.x }}
      >
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

  if (view === "list") {
    return (
      <div
        className={`relative transition-colors ${hovered ? "bg-[#f6f8fc]" : ""} ${selected ? "bg-[#e8f0fe]" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={handleContextMenu}
      >
        <Link href={`/folder/${folder.id}`} onClick={handleClick}>
          <div className="flex items-center gap-3 px-4 py-2 cursor-pointer">
            {/* Checkbox */}
            <div
              onClick={handleCheckbox}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all shrink-0
                ${selected ? "bg-[#1a73e8] border-[#1a73e8]" : "bg-white border-[#9aa0a6]"}
                ${showCheckbox ? "opacity-100" : "opacity-0"}`}
            >
              {selected && <CheckCircle2 size={14} className="text-white" strokeWidth={3} />}
            </div>
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <Folder size={20} className="text-[#F9AB00]" fill="#FFF0C2" />
            </div>
            <p className="flex-1 text-sm text-[#202124] font-medium truncate min-w-0">{folder.name}</p>
            <p className="w-40 text-sm text-[#444746] hidden md:block">Carpeta</p>
            <p className="w-32 text-sm text-[#444746] hidden lg:block">—</p>
            <p className="w-24 text-sm text-[#444746] text-right shrink-0">—</p>
            <div className="w-8 shrink-0" />
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
      <Link href={`/folder/${folder.id}`} onClick={handleClick}>
        <div className={`border rounded-xl overflow-hidden cursor-pointer transition-all
          ${selected
            ? "border-[#1a73e8] bg-[#e8f0fe] shadow-md"
            : hovered
            ? "border-[#dadce0] bg-white shadow-md"
            : "border-[#dadce0] bg-white"}`}
        >
          {/* Preview */}
          <div className={`h-36 flex items-center justify-center border-b relative
            ${selected ? "bg-[#d2e3fc] border-[#1a73e8]/20" : "bg-[#FFF8E1] border-[#F5E6B2]"}`}>

            {/* Checkbox */}
            <div
              onClick={handleCheckbox}
              className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all z-10
                ${selected ? "bg-[#1a73e8] border-[#1a73e8]" : "bg-white border-[#9aa0a6]"}
                ${showCheckbox ? "opacity-100" : "opacity-0"}`}
            >
              {selected && <CheckCircle2 size={16} className="text-white" strokeWidth={3} />}
            </div>

            {/* Folder shape */}
            <div className="flex flex-col items-start gap-0 w-20">
              <div className="h-3 w-10 bg-[#F9AB00] rounded-t-md ml-2" />
              <div className="w-20 h-14 bg-[#F9AB00] rounded-b-xl rounded-tr-xl flex items-center justify-center">
                <div className="w-10 h-1.5 bg-[#E8951A] rounded-full opacity-60" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-3 py-2.5">
            <Folder size={16} className="text-[#F9AB00] shrink-0" fill="#FFF0C2" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[#202124] truncate font-medium">{folder.name}</p>
              {meta && <p className="text-xs text-[#444746] truncate">{meta}</p>}
            </div>
          </div>
        </div>
      </Link>

      {/* Menú ⋮ */}
      {(hovered || menuOpen) && (
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={handleMenuButton}
            className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm shadow flex items-center justify-center hover:bg-white transition-colors"
          >
            <MoreVertical size={16} className="text-[#444746]" />
          </button>
        </div>
      )}

      {contextMenu}
    </div>
  );
}
