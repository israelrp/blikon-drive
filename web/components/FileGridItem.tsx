"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical, Download, Trash2, Info, CheckCircle2 } from "lucide-react";
import { DriveFile, getDownloadUrl, deleteFile } from "@/lib/api";
import { FileTypeIcon } from "./FileTypeIcon";
import { formatBytes } from "@/lib/utils";

export function FileGridItem({
  file,
  selected,
  onSelect,
  onDeleted,
  canWrite = true,
}: {
  file: DriveFile;
  selected: boolean;
  onSelect: (id: string) => void;
  onDeleted: () => void;
  canWrite?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const showCheckbox = selected || hovered;

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

  function handleClick(e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onSelect(file.id);
    }
  }

  function handleCheckbox(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onSelect(file.id);
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={`/file/${file.id}`} onClick={handleClick}>
        <div className={`border rounded-xl overflow-hidden transition-all cursor-pointer
          ${selected
            ? "border-[#1a73e8] bg-[#e8f0fe] shadow-md"
            : "border-[#dadce0] bg-white hover:shadow-md hover:border-[#1a73e8]/30"}`}>

          {/* Preview */}
          <div className={`h-36 flex items-center justify-center border-b relative
            ${selected ? "bg-[#d2e3fc] border-[#1a73e8]/20" : "bg-[#f8f9fa] border-[#dadce0]"}`}>

            {/* Checkbox */}
            <div
              onClick={handleCheckbox}
              className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all z-10
                ${selected
                  ? "bg-[#1a73e8] border-[#1a73e8]"
                  : "bg-white border-[#9aa0a6]"}
                ${showCheckbox ? "opacity-100" : "opacity-0"}`}
            >
              {selected && <CheckCircle2 size={16} className="text-white" strokeWidth={3} />}
            </div>

            <FileTypeIcon extension={file.extension} size="lg" />
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-3 py-2">
            <FileTypeIcon extension={file.extension} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[#202124] truncate font-medium">
                {file.title ?? file.name}
              </p>
              <p className="text-xs text-[#444746]">{formatBytes(file.sizeBytes)}</p>
            </div>
          </div>
        </div>
      </Link>

      {/* Menú ⋮ */}
      {(hovered || menuOpen) && (
        <div className="absolute top-2 right-2">
          <div className="relative">
            <button
              onClick={(e) => { e.preventDefault(); setMenuOpen((o) => !o); }}
              className="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center hover:bg-gray-100"
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
                  {canWrite && (
                    <>
                      <div className="border-t border-[#dadce0] my-1" />
                      <button onClick={handleDelete} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                        <Trash2 size={16} /> Eliminar
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
