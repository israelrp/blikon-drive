"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical, Download, Trash2, Info } from "lucide-react";
import { DriveFile, getDownloadUrl, deleteFile } from "@/lib/api";
import { FileTypeIcon } from "./FileTypeIcon";
import { formatBytes } from "@/lib/utils";

export function FileListItem({
  file,
  selected,
  onSelect,
  onDeleted,
}: {
  file: DriveFile;
  selected: boolean;
  onSelect: (id: string) => void;
  onDeleted: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  async function handleDownload(e: React.MouseEvent) {
    e.preventDefault();
    const url = await getDownloadUrl(file.id);
    window.open(url, "_blank");
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    await deleteFile(file.id);
    onDeleted();
  }

  return (
    <div
      className={`relative transition-colors ${selected ? "bg-[#e8f0fe]" : hovered ? "bg-[#f6f8fc]" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/file/${file.id}`}
        onClick={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); onSelect(file.id); } }}
      >
        <div className="flex items-center gap-3 px-4 py-2 cursor-pointer">

          {/* Checkbox / ícono */}
          <div
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(file.id); }}
            className="w-8 h-8 flex items-center justify-center shrink-0 rounded-full cursor-pointer hover:bg-[#e9eef6]"
          >
            {selected ? (
              <div className="w-5 h-5 rounded-full bg-[#1a73e8] flex items-center justify-center">
                <svg viewBox="0 0 12 12" width="12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            ) : hovered ? (
              <div className="w-5 h-5 rounded-full border-2 border-[#9aa0a6] bg-white" />
            ) : (
              <FileTypeIcon extension={file.extension} size="sm" />
            )}
          </div>

          <p className="flex-1 text-sm text-[#202124] truncate font-medium min-w-0">
            {file.title ?? file.name}
          </p>
          <p className="w-40 text-sm text-[#444746] truncate hidden md:block">{file.name}</p>
          <p className="w-32 text-sm text-[#444746] hidden lg:block" suppressHydrationWarning>
            {new Date(file.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          <p className="w-24 text-sm text-[#444746] text-right shrink-0">{formatBytes(file.sizeBytes)}</p>

          {/* Menú ⋮ */}
          <div className="relative w-8 shrink-0">
            <button
              onClick={(e) => { e.preventDefault(); setMenuOpen((o) => !o); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#e9eef6] transition-all
                ${hovered || menuOpen ? "opacity-100" : "opacity-0"}`}
            >
              <MoreVertical size={16} className="text-[#444746]" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-20 bg-white rounded-xl shadow-xl border border-[#dadce0] py-2 w-44">
                  <button onClick={handleDownload} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-[#202124] hover:bg-gray-100">
                    <Download size={16} className="text-[#444746]" /> Descargar
                  </button>
                  <Link href={`/file/${file.id}`} className="flex items-center gap-3 px-4 py-2 text-sm text-[#202124] hover:bg-gray-100">
                    <Info size={16} className="text-[#444746]" /> Ver detalles
                  </Link>
                  <div className="border-t border-[#dadce0] my-1" />
                  <button onClick={handleDelete} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                    <Trash2 size={16} /> Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
