export function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function fileIcon(mimeType: string | null, extension: string | null): string {
  if (!mimeType) return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📕";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("spreadsheet") || extension === "xlsx" || extension === "csv") return "📊";
  if (mimeType.includes("word") || extension === "docx") return "📝";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "🗜️";
  return "📄";
}

// Parsea el subdominio en dev desde la URL de localhost
// En prod lo resuelve el middleware desde el host header
export function parseFolderPath(host: string): { account: string; folders: string[] } | null {
  // dev: drive-cuenta-folder1-folder2.localhost  o  header x-blikon-folder
  const match = host.match(/^drive-([^.]+)(?:\.localhost|\.com\.blog)/);
  if (!match) return null;
  const [, rest] = match;
  const parts = rest.split("-");
  return { account: parts[0], folders: parts.slice(1) };
}
