// URL pública por subdominio de un folder: drive-{crono}-{f1}-{f2}.com.blog
// Los nombres de folder no tienen guiones, así que "/" del path → "-".
export function folderSubdomainUrl(cronoCode: string, folderId: string): string {
  const path = folderId.split("/").filter(Boolean).join("-");
  return path
    ? `https://drive-${cronoCode}-${path}.com.blog`
    : `https://drive-${cronoCode}.com.blog`;
}

// Inverso de folderSubdomainUrl: del host del subdominio extrae el folderId.
// drive-{crono}-{f1}-{f2}.com.blog → "f1/f2"  (descarta el cronoCode).
// Devuelve null si no es un subdominio de folder (p. ej. drive.com.blog).
export function folderIdFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  // Quitar puerto si lo hubiera y normalizar.
  const clean = host.split(":")[0].toLowerCase();
  const m = clean.match(/^drive-(.+)\.com\.blog$/);
  if (!m) return null;
  const segs = m[1].split("-").filter(Boolean);
  const folderSegs = segs.slice(1); // saltar cronoCode
  return folderSegs.length > 0 ? folderSegs.join("/") : null;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
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
