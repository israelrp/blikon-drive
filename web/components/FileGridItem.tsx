"use client";

import { useState } from "react";
import { MoreVertical, Download, Trash2, Info, CheckCircle2, Copy, FolderInput } from "lucide-react";
import { DriveFile, getDownloadUrl, deleteFile } from "@/lib/api";
import { FileTypeIcon } from "./FileTypeIcon";
import { formatBytes } from "@/lib/utils";
import { useConfirm } from "./ConfirmDialog";
import { useNav } from "@/app/NavContext";

export function FileGridItem({
  file,
  selected,
  onSelect,
  onDeleted,
  onMoveCopy,
  canWrite = true,
  blikonId,
  phoneNumber,
}: {
  file: DriveFile;
  selected: boolean;
  onSelect: (id: string) => void;
  onDeleted: () => void;
  onMoveCopy?: (fileId: string, mode: "move" | "copy") => void;
  canWrite?: boolean;
  blikonId?: string;
  phoneNumber?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const confirm = useConfirm();
  const { openFile } = useNav();

  const showCheckbox = selected || hovered;

  async function handleDownload(e: React.MouseEvent) {
    e.preventDefault();
    const url = await getDownloadUrl(file.id);
    window.open(url, "_blank");
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    setMenuOpen(false);
    const ok = await confirm({
      title: "Eliminar archivo",
      message: `¿Eliminar "${file.title ?? file.name}"? Se moverá a la papelera.`,
    });
    if (!ok) return;
    await deleteFile(file.id, blikonId, phoneNumber);
    onDeleted();
  }

  function handleClick(e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onSelect(file.id);
      return;
    }
    openFile(file.id);   // abre el detalle como overlay (sin cambiar URL)
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
      <div onClick={handleClick} role="button">
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
      </div>

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
                  <button onClick={(e) => { e.preventDefault(); setMenuOpen(false); openFile(file.id); }} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-[#202124] hover:bg-gray-100">
                    <Info size={16} className="text-[#444746]" /> Ver detalles
                  </button>
                  {onMoveCopy && (
                    <button onClick={(e) => { e.preventDefault(); setMenuOpen(false); onMoveCopy(file.id, "copy"); }} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-[#202124] hover:bg-gray-100">
                      <Copy size={16} className="text-[#444746]" /> Copiar a…
                    </button>
                  )}
                  {canWrite && (
                    <>
                      {onMoveCopy && (
                        <button onClick={(e) => { e.preventDefault(); setMenuOpen(false); onMoveCopy(file.id, "move"); }} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-[#202124] hover:bg-gray-100">
                          <FolderInput size={16} className="text-[#444746]" /> Mover a…
                        </button>
                      )}
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
