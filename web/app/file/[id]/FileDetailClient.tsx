"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDetail, addComment, updateMetadata, getDownloadUrl, deleteFile } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { FilePreview } from "@/components/FilePreview";
import { ArrowLeft, Download, Trash2, ChevronRight } from "lucide-react";
import Link from "next/link";

export function FileDetailClient({
  file,
  folderId,
  blikonId,
  phoneNumber,
}: {
  file: FileDetail;
  folderId: string;
  blikonId?: string;
  phoneNumber?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(file.title ?? "");
  const [description, setDescription] = useState(file.description ?? "");
  const [tags, setTags] = useState(file.tags.join(", "));
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState(file.comments);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "activity">("details");

  async function handleSave() {
    setSaving(true);
    await updateMetadata(file.id, {
      title: title || undefined,
      description: description || undefined,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    }, blikonId, phoneNumber);
    setSaving(false);
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    const c = await addComment(file.id, newComment, blikonId, phoneNumber);
    setComments((p) => [...p, c]);
    setNewComment("");
  }

  async function handleDownload() {
    const url = await getDownloadUrl(file.id);
    window.open(url, "_blank");
  }

  async function handleDelete() {
    if (!confirm("¿Mover a la papelera?")) return;
    await deleteFile(file.id, blikonId, phoneNumber);
    router.push(`/folder/${folderId}`);
  }

  return (
    <div className="flex flex-col h-screen bg-[#f6f8fc]">
      {/* Header */}
      <header className="h-16 flex items-center gap-4 px-4 bg-[#f6f8fc] border-b border-[#dadce0] shrink-0">
        <Link
          href={`/folder/${folderId}`}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#e9eef6] transition-colors"
        >
          <ArrowLeft size={20} className="text-[#444746]" />
        </Link>

        <div className="flex items-center gap-2 text-sm text-[#444746] min-w-0">
          <span className="hidden sm:inline shrink-0">Mi Drive</span>
          <ChevronRight size={14} className="hidden sm:inline shrink-0" />
          <Link href={`/folder/${folderId}`} className="hidden md:inline font-mono text-xs bg-gray-200 px-2 py-0.5 rounded shrink-0 max-w-[180px] truncate hover:bg-gray-300">{folderId}</Link>
          <ChevronRight size={14} className="hidden md:inline shrink-0" />
          <span className="text-[#202124] font-medium truncate">{file.name}</span>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 justify-center w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2 text-sm font-medium text-[#1a73e8] bg-[#e8f0fe] rounded-full hover:bg-[#d2e3fc] transition-colors"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Descargar</span>
          </button>
          <button
            onClick={handleDelete}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors"
            title="Eliminar"
          >
            <Trash2 size={18} className="text-[#444746] hover:text-red-500" />
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
        {/* Preview / main */}
        <div className="h-[55vh] md:h-auto md:flex-1 md:min-h-0 flex flex-col bg-[#f8f9fa] md:border-r border-[#dadce0] shrink-0 md:shrink">
          <div className="flex-1 min-h-0 flex items-center justify-center p-6 overflow-auto">
            <FilePreview
              fileId={file.id}
              mimeType={file.mimeType}
              extension={file.extension}
              name={file.name}
            />
          </div>
          <div className="shrink-0 text-center px-6 py-3 border-t border-[#e8eaed] bg-white/60">
            <h1 className="text-base font-medium text-[#202124] truncate">{file.title ?? file.name}</h1>
            <p className="text-xs text-[#444746] truncate">{file.name}</p>
          </div>
        </div>

        {/* Details panel — debajo del preview en mobile, a la derecha en desktop */}
        <aside className="w-full md:w-80 shrink-0 overflow-y-auto bg-[#f6f8fc] flex flex-col border-t md:border-t-0 border-[#dadce0]">
          {/* Tabs */}
          <div className="flex border-b border-[#dadce0] px-2 pt-2 shrink-0">
            {(["details", "activity"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-medium rounded-t-lg transition-colors
                  ${activeTab === tab
                    ? "text-[#1a73e8] border-b-2 border-[#1a73e8]"
                    : "text-[#444746] hover:bg-[#e9eef6]"}`}
              >
                {tab === "details" ? "Detalles" : "Actividad"}
              </button>
            ))}
          </div>

          <div className="md:flex-1 md:overflow-y-auto p-4 flex flex-col gap-4">
            {activeTab === "details" ? (
              <>
                {/* Info fija */}
                <div className="bg-white rounded-xl border border-[#dadce0] p-4 flex flex-col gap-3">
                  <Row label="Tipo" value={file.mimeType ?? "—"} />
                  <Row label="Tamaño" value={formatBytes(file.sizeBytes)} />
                  <Row label="Extensión" value={`.${file.extension ?? "—"}`} mono />
                  <Row label="Folder" value={file.coreFolderId} mono />
                  <Row label="Subido" value={new Date(file.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })} suppress />
                  {file.exifExtractedAt && <Row label="EXIF" value="Extraído" />}
                  {file.contentIndexedAt && <Row label="Indexado" value={new Date(file.contentIndexedAt).toLocaleDateString("es-MX")} suppress />}
                </div>

                {/* EXIF */}
                {file.exif && (
                  <div className="bg-white rounded-xl border border-[#dadce0] p-4">
                    <p className="text-xs font-medium text-[#444746] uppercase tracking-wide mb-3">EXIF</p>
                    <div className="flex flex-col gap-2">
                      {Object.entries(file.exif)
                        .filter(([k]) => !k.includes("Component") && !k.includes("Huffman"))
                        .slice(0, 10)
                        .map(([k, v]) => (
                          <Row key={k} label={k.split("/")[1] ?? k} value={String(v)} />
                        ))}
                    </div>
                  </div>
                )}

                {/* Metadata editable */}
                <div className="bg-white rounded-xl border border-[#dadce0] p-4 flex flex-col gap-3">
                  <p className="text-xs font-medium text-[#444746] uppercase tracking-wide">Editar metadata</p>
                  <Field label="Título" value={title} onChange={setTitle} placeholder="Sin título" />
                  <Field label="Descripción" value={description} onChange={setDescription} placeholder="Agregar descripción" textarea />
                  <Field label="Etiquetas" value={tags} onChange={setTags} placeholder="diseño, cliente, borrador" />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-full hover:bg-[#1557b0] disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </>
            ) : (
              /* Activity / Comments */
              <div className="bg-white rounded-xl border border-[#dadce0] p-4 flex flex-col gap-4">
                <p className="text-xs font-medium text-[#444746] uppercase tracking-wide">Comentarios</p>
                <div className="flex flex-col gap-4">
                  {comments.length === 0 && (
                    <p className="text-sm text-[#444746] text-center py-4">Sin comentarios</p>
                  )}
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1a73e8] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {c.blikonId[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs text-[#444746] mb-0.5">{c.blikonId}</p>
                        <p className="text-sm text-[#202124]">{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    placeholder="Agregar comentario"
                    className="flex-1 px-3 py-2 text-sm border border-[#dadce0] rounded-full focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-[#f6f8fc]"
                  />
                  <button
                    onClick={handleAddComment}
                    className="px-4 py-2 text-sm font-medium text-[#1a73e8] hover:bg-[#e8f0fe] rounded-full transition-colors"
                  >
                    Enviar
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, mono, suppress }: { label: string; value: string; mono?: boolean; suppress?: boolean }) {
  return (
    <div>
      <p className="text-xs text-[#444746]">{label}</p>
      <p className={`text-sm text-[#202124] truncate ${mono ? "font-mono" : ""}`} suppressHydrationWarning={suppress}>
        {value}
      </p>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  const base = "w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-[#f6f8fc]";
  return (
    <div>
      <label className="text-xs text-[#444746] mb-1 block">{label}</label>
      {textarea ? (
        <textarea className={`${base} resize-none`} rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input className={base} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}
