"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { MoreVertical, Download, Trash2, Info } from "lucide-react";
import { DriveFile, updateMetadata, getDownloadUrl, deleteFile } from "@/lib/api";
import { FileTypeIcon } from "./FileTypeIcon";
import { formatBytes } from "@/lib/utils";

type EditField = "title" | "description" | "tags";

interface LocalFile extends DriveFile {
  _title: string;
  _description: string;
  _tags: string;
}

function initLocal(f: DriveFile): LocalFile {
  return {
    ...f,
    _title: f.title ?? "",
    _description: f.description ?? "",
    _tags: f.tags.join(", "),
  };
}

interface CellProps {
  value: string;
  placeholder: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onTabNext: () => void;
  multiline?: boolean;
  className?: string;
}

function EditableCell({
  value, placeholder, isEditing, onStartEdit, onChange, onSave, onCancel, onTabNext, multiline, className = "",
}: CellProps) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(); }
    if (e.key === "Escape") onCancel();
    if (e.key === "Tab") { e.preventDefault(); onSave(); onTabNext(); }
  }

  if (isEditing) {
    const base = "w-full px-2 py-1 text-sm bg-white border-2 border-[#1a73e8] outline-none resize-none";
    return multiline ? (
      <textarea
        ref={ref as any}
        autoFocus
        value={value}
        placeholder={placeholder}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onSave}
        className={`${base} rounded ${className}`}
      />
    ) : (
      <input
        ref={ref as any}
        autoFocus
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onSave}
        className={`${base} rounded ${className}`}
      />
    );
  }

  return (
    <div
      onClick={onStartEdit}
      className={`px-2 py-1 text-sm cursor-text rounded hover:bg-[#f0f4ff] transition-colors min-h-[28px] ${
        value ? "text-[#202124]" : "text-[#9aa0a6] italic"
      } ${className}`}
    >
      {value || placeholder}
    </div>
  );
}

export function FileTableView({
  files: initialFiles,
  selected,
  onSelect,
  onDeleted,
  canWrite = true,
  blikonId,
  phoneNumber,
}: {
  files: DriveFile[];
  selected: Set<string>;
  onSelect: (id: string) => void;
  onDeleted: () => void;
  canWrite?: boolean;
  blikonId?: string;
  phoneNumber?: string;
}) {
  const [files, setFiles] = useState<LocalFile[]>(initialFiles.map(initLocal));
  const [editing, setEditing] = useState<{ id: string; field: EditField } | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Sincronizar cuando llegan nuevos archivos desde el padre
  const prevLen = useRef(initialFiles.length);
  if (initialFiles.length !== prevLen.current) {
    prevLen.current = initialFiles.length;
    setFiles(initialFiles.map(initLocal));
  }

  function startEdit(id: string, field: EditField) {
    setEditing({ id, field });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function saveEdit(file: LocalFile, field: EditField) {
    setEditing(null);
    const payload = {
      title:       file._title.trim() || undefined,
      description: file._description.trim() || undefined,
      tags:        file._tags ? file._tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    };
    await updateMetadata(file.id, payload, blikonId, phoneNumber).catch(() => {});
  }

  function updateLocal(id: string, patch: Partial<LocalFile>) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  function tabToNext(currentId: string, currentField: EditField) {
    const fields: EditField[] = ["title", "description", "tags"];
    const fi = fields.indexOf(currentField);
    if (fi < fields.length - 1) {
      setEditing({ id: currentId, field: fields[fi + 1] });
    } else {
      // Pasar al siguiente archivo, primer campo
      const idx = files.findIndex(f => f.id === currentId);
      if (idx < files.length - 1) {
        setEditing({ id: files[idx + 1].id, field: "title" });
      }
    }
  }

  async function handleDownload(e: React.MouseEvent, id: string) {
    e.preventDefault();
    const url = await getDownloadUrl(id);
    window.open(url, "_blank");
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    await deleteFile(id, blikonId, phoneNumber);
    onDeleted();
  }

  return (
    <div className="bg-white rounded-xl border border-[#dadce0] overflow-x-auto">
      {/* Header */}
      <div className="flex items-center bg-[#f8f9fa] border-b-2 border-[#dadce0] text-xs font-semibold text-[#444746] uppercase tracking-wide select-none min-w-[72rem]">
        <div className="w-10 shrink-0 px-3 py-2.5" />
        <div className="w-10 shrink-0 px-2 py-2.5" />
        <div className="w-96 shrink-0 px-2 py-2.5 border-l border-[#e8eaed]">Nombre</div>
        <div className="w-44 shrink-0 px-2 py-2.5 border-l border-[#e8eaed]">
          Título <span className="normal-case font-normal text-[#1a73e8]">✎</span>
        </div>
        <div className="flex-1 min-w-0 px-2 py-2.5 border-l border-[#e8eaed]">
          Descripción <span className="normal-case font-normal text-[#1a73e8]">✎</span>
        </div>
        <div className="w-44 shrink-0 px-2 py-2.5 border-l border-[#e8eaed]">
          Etiquetas <span className="normal-case font-normal text-[#1a73e8]">✎</span>
        </div>
        <div className="w-24 shrink-0 px-2 py-2.5 border-l border-[#e8eaed] text-right">Tamaño</div>
        <div className="w-28 shrink-0 px-2 py-2.5 border-l border-[#e8eaed]">Modificado</div>
        <div className="w-10 shrink-0 border-l border-[#e8eaed]" />
      </div>

      {/* Filas */}
      {files.map((file, i) => {
        const isSelected = selected.has(file.id);
        const isEditingThis = (field: EditField) => editing?.id === file.id && editing?.field === field;

        return (
          <div
            key={file.id}
            className={`flex items-center border-b border-[#f0f0f0] last:border-0 transition-colors min-w-[72rem]
              ${isSelected ? "bg-[#e8f0fe]" : i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}
              hover:bg-[#f6f8fc]`}
          >
            {/* Checkbox */}
            <div
              className="w-10 shrink-0 px-3 py-1.5 flex items-center justify-center cursor-pointer"
              onClick={() => onSelect(file.id)}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                ${isSelected ? "bg-[#1a73e8] border-[#1a73e8]" : "border-[#9aa0a6] hover:border-[#1a73e8]"}`}>
                {isSelected && (
                  <svg viewBox="0 0 10 10" width="10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>

            {/* Ícono */}
            <div className="w-10 shrink-0 px-1 py-1.5 flex items-center justify-center">
              <FileTypeIcon extension={file.extension} size="sm" />
            </div>

            {/* Nombre — columna ancha; la tabla scrollea horizontal en mobile */}
            <div className="w-96 shrink-0 border-l border-[#f0f0f0]">
              <Link href={`/file/${file.id}`}
                className="block px-2 py-1.5 text-sm text-[#202124] hover:text-[#1a73e8] truncate font-medium"
                title={file.name}
              >
                {file.name}
              </Link>
            </div>

            {/* Título editable */}
            <div className="w-44 shrink-0 border-l border-[#f0f0f0] py-0.5 px-1">
              <EditableCell
                value={file._title}
                placeholder="Agregar título"
                isEditing={isEditingThis("title")}
                onStartEdit={() => startEdit(file.id, "title")}
                onChange={(v) => updateLocal(file.id, { _title: v })}
                onSave={() => saveEdit(file, "title")}
                onCancel={cancelEdit}
                onTabNext={() => tabToNext(file.id, "title")}
              />
            </div>

            {/* Descripción editable */}
            <div className="flex-1 min-w-0 border-l border-[#f0f0f0] py-0.5 px-1">
              <EditableCell
                value={file._description}
                placeholder="Agregar descripción"
                isEditing={isEditingThis("description")}
                onStartEdit={() => startEdit(file.id, "description")}
                onChange={(v) => updateLocal(file.id, { _description: v })}
                onSave={() => saveEdit(file, "description")}
                onCancel={cancelEdit}
                onTabNext={() => tabToNext(file.id, "description")}
                multiline
              />
            </div>

            {/* Etiquetas editables */}
            <div className="w-44 shrink-0 border-l border-[#f0f0f0] py-0.5 px-1">
              <EditableCell
                value={file._tags}
                placeholder="tag1, tag2"
                isEditing={isEditingThis("tags")}
                onStartEdit={() => startEdit(file.id, "tags")}
                onChange={(v) => updateLocal(file.id, { _tags: v })}
                onSave={() => saveEdit(file, "tags")}
                onCancel={cancelEdit}
                onTabNext={() => tabToNext(file.id, "tags")}
              />
            </div>

            {/* Tamaño */}
            <div className="w-24 shrink-0 px-2 py-1.5 text-sm text-[#444746] text-right border-l border-[#f0f0f0]">
              {formatBytes(file.sizeBytes)}
            </div>

            {/* Fecha */}
            <div className="w-28 shrink-0 px-2 py-1.5 text-xs text-[#444746] border-l border-[#f0f0f0]" suppressHydrationWarning>
              {new Date(file.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "2-digit" })}
            </div>

            {/* Menú ⋮ */}
            <div className="w-10 shrink-0 border-l border-[#f0f0f0] flex items-center justify-center relative">
              <button
                onClick={() => setMenuOpen(menuOpen === file.id ? null : file.id)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#e9eef6] transition-colors"
              >
                <MoreVertical size={14} className="text-[#444746]" />
              </button>
              {menuOpen === file.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                  <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border border-[#dadce0] py-2 w-44">
                    <button
                      onClick={(e) => { handleDownload(e, file.id); setMenuOpen(null); }}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-[#202124] hover:bg-gray-100"
                    >
                      <Download size={15} className="text-[#444746]" /> Descargar
                    </button>
                    <Link
                      href={`/file/${file.id}`}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-[#202124] hover:bg-gray-100"
                      onClick={() => setMenuOpen(null)}
                    >
                      <Info size={15} className="text-[#444746]" /> Ver detalles
                    </Link>
                    {canWrite && (
                      <>
                        <div className="border-t border-[#dadce0] my-1" />
                        <button
                          onClick={(e) => { handleDelete(e, file.id); setMenuOpen(null); }}
                          className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={15} /> Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
