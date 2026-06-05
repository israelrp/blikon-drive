"use client";

import { useEffect, useState } from "react";
import { Loader2, FileQuestion, Download } from "lucide-react";
import { getDownloadUrl } from "@/lib/api";
import { FileTypeIcon } from "./FileTypeIcon";

type Kind = "image" | "video" | "audio" | "pdf" | "text" | "office" | "none";

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "csv", "tsv", "log", "json", "xml", "yml", "yaml",
  "html", "htm", "css", "js", "ts", "tsx", "jsx", "py", "java", "c", "cpp",
  "cs", "go", "rs", "rb", "php", "sql", "sh", "ini", "conf", "env",
]);
const OFFICE_EXT = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx"]);

function kindOf(mime: string | null, ext: string | null): Kind {
  const m = (mime ?? "").toLowerCase();
  const e = (ext ?? "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf" || e === "pdf") return "pdf";
  if (m.startsWith("text/") || TEXT_EXT.has(e)) return "text";
  if (OFFICE_EXT.has(e)) return "office";
  return "none";
}

export function FilePreview({
  fileId,
  mimeType,
  extension,
  name,
}: {
  fileId: string;
  mimeType: string | null;
  extension: string | null;
  name: string;
}) {
  const kind = kindOf(mimeType, extension);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (kind === "none") { setLoading(false); return; }
    setLoading(true);
    getDownloadUrl(fileId, true)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fileId, kind]);

  if (kind === "none") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-[#444746]">
        <FileTypeIcon extension={extension} size="lg" />
        <div className="flex flex-col items-center gap-1">
          <FileQuestion size={20} className="text-[#9aa0a6]" />
          <p className="text-sm">No hay vista previa para este tipo de archivo</p>
          <p className="text-xs text-[#9aa0a6]">Descárgalo para abrirlo</p>
        </div>
      </div>
    );
  }

  if (loading || !url) {
    return (
      <div className="flex items-center gap-2 text-[#9aa0a6]">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Cargando vista previa…</span>
      </div>
    );
  }

  switch (kind) {
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
      );
    case "video":
      return (
        <video src={url} controls className="max-w-full max-h-full rounded-lg shadow-sm bg-black">
          Tu navegador no soporta video.
        </video>
      );
    case "audio":
      return (
        <div className="w-full max-w-md flex flex-col items-center gap-4">
          <FileTypeIcon extension={extension} size="lg" />
          <audio src={url} controls className="w-full">Tu navegador no soporta audio.</audio>
        </div>
      );
    case "pdf":
      return (
        <iframe src={url} title={name} className="w-full h-full rounded-lg border border-[#dadce0] bg-white" />
      );
    case "text":
      return (
        <iframe src={url} title={name} className="w-full h-full rounded-lg border border-[#dadce0] bg-white" />
      );
    case "office": {
      const viewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
      return (
        <iframe src={viewer} title={name} className="w-full h-full rounded-lg border border-[#dadce0] bg-white" />
      );
    }
    default:
      return null;
  }
}
