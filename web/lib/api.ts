const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5086";

// Header que identifica al usuario en el API
function blikonHeader(blikonId?: string): HeadersInit {
  return blikonId ? { "X-Blikon-Id": blikonId } : {};
}

// Headers de identidad + teléfono (para acceso a folders compartidos)
function authHeaders(blikonId?: string, phoneNumber?: string): Record<string, string> {
  const h: Record<string, string> = {};
  if (blikonId) h["X-Blikon-Id"] = blikonId;
  if (phoneNumber) h["X-Phone-Number"] = phoneNumber;
  return h;
}

export interface DriveFile {
  id: string;
  name: string;
  extension: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  title: string | null;
  description: string | null;
  tags: string[];
  uploadStatus: number;
  coreFolderId: string;
  createdAt: string;
}

export interface FileDetail extends DriveFile {
  azureBlobPath: string;
  exif: Record<string, string> | null;
  exifExtractedAt: string | null;
  contentText: string | null;
  contentIndexedAt: string | null;
  comments: Comment[];
}

export interface Comment {
  id: string;
  blikonId: string;
  body: string;
  createdAt: string;
}

export async function getFilesByFolder(coreFolderId: string, blikonId?: string, phoneNumber?: string): Promise<DriveFile[]> {
  const res = await fetch(`${API}/api/files/folder?coreFolderId=${encodeURIComponent(coreFolderId)}`,
    { cache: "no-store", headers: authHeaders(blikonId, phoneNumber) });
  if (!res.ok) throw new Error("Error cargando archivos");
  return res.json();
}

export async function getFileById(id: string): Promise<FileDetail> {
  const res = await fetch(`${API}/api/files/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Archivo no encontrado");
  return res.json();
}

export async function searchFiles(q: string, coreFolderId?: string, blikonId?: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({ q });
  if (coreFolderId) params.set("coreFolderId", coreFolderId);
  const res = await fetch(`${API}/api/files/search?${params}`,
    { cache: "no-store", headers: blikonHeader(blikonId) });
  if (!res.ok) throw new Error("Error en búsqueda");
  return res.json();
}

export interface StorageUsage { usedBytes: number; quotaBytes: number; fileCount: number; }

export async function getStorageUsage(blikonId?: string): Promise<StorageUsage> {
  const res = await fetch(`${API}/api/files/storage`,
    { cache: "no-store", headers: blikonHeader(blikonId) });
  if (!res.ok) return { usedBytes: 0, quotaBytes: 0, fileCount: 0 };
  return res.json();
}

export async function getDownloadUrl(id: string, inline = false): Promise<string> {
  const res = await fetch(`${API}/api/files/${id}/download${inline ? "?inline=true" : ""}`);
  const data = await res.json();
  return data.url;
}

export async function updateMetadata(
  id: string,
  payload: { title?: string; description?: string; tags?: string[] },
  blikonId?: string,
  phoneNumber?: string
) {
  const res = await fetch(`${API}/api/files/${id}/metadata`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(blikonId, phoneNumber) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Error actualizando metadata");
  return res.json();
}

export async function addComment(id: string, body: string, blikonId?: string, phoneNumber?: string) {
  const res = await fetch(`${API}/api/files/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(blikonId, phoneNumber) },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error("Error agregando comentario");
  return res.json();
}

export async function deleteFile(id: string, blikonId?: string, phoneNumber?: string) {
  await fetch(`${API}/api/files/${id}`, { method: "DELETE", headers: authHeaders(blikonId, phoneNumber) });
}

export async function batchDeleteFiles(ids: string[], blikonId?: string, phoneNumber?: string): Promise<number> {
  const res = await fetch(`${API}/api/files/batch-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(blikonId, phoneNumber) },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Error eliminando archivos");
  const data = await res.json();
  return data.deleted;
}

export interface DriveFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  childCount: number;
  fileCount: number;
}

export async function deleteFolder(id: string, blikonId?: string, phoneNumber?: string): Promise<void> {
  await fetch(`${API}/api/folders?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(blikonId, phoneNumber),
  });
}

export async function batchDeleteFolders(ids: string[], blikonId?: string, phoneNumber?: string): Promise<void> {
  await fetch(`${API}/api/folders/batch-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(blikonId, phoneNumber) },
    body: JSON.stringify({ ids }),
  });
}

export async function ensureFolder(path: string, blikonId?: string, parentId?: string, phoneNumber?: string): Promise<DriveFolder> {
  const res = await fetch(`${API}/api/folders/ensure`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(blikonId, phoneNumber) },
    body: JSON.stringify({ path, parentId }),
  });
  if (!res.ok) throw new Error("Error creando folder");
  return res.json();
}

// ─── Compartir folders ───────────────────────────────────────────────────────

export type SharePermission = "viewer" | "editor";

export interface FolderShare {
  id: string;
  phoneNumber: string;
  permission: SharePermission;
  createdAt: string;
}

export interface SharedFolder extends DriveFolder {
  ownerBlikonId: string;
  permission: SharePermission;
  shareId: string;
}

export async function shareFolder(
  folderId: string,
  phoneNumber: string,
  permission: SharePermission,
  blikonId?: string,
): Promise<void> {
  const res = await fetch(`${API}/api/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...blikonHeader(blikonId) },
    body: JSON.stringify({ folderId, phoneNumber, permission }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error compartiendo folder");
  }
}

export async function getFolderShares(folderId: string, blikonId?: string): Promise<FolderShare[]> {
  const res = await fetch(`${API}/api/shares?folderId=${encodeURIComponent(folderId)}`,
    { cache: "no-store", headers: blikonHeader(blikonId) });
  if (!res.ok) return [];
  return res.json();
}

export async function unshareFolder(shareId: string, blikonId?: string): Promise<void> {
  await fetch(`${API}/api/shares/${shareId}`, { method: "DELETE", headers: blikonHeader(blikonId) });
}

export async function getSharedWithMe(phoneNumber?: string, blikonId?: string): Promise<SharedFolder[]> {
  const headers: HeadersInit = { ...blikonHeader(blikonId) };
  if (phoneNumber) (headers as Record<string, string>)["X-Phone-Number"] = phoneNumber;
  const res = await fetch(`${API}/api/shares/with-me`, { cache: "no-store", headers });
  if (!res.ok) return [];
  return res.json();
}

export async function getFolderChildren(parentId?: string, blikonId?: string, phoneNumber?: string): Promise<DriveFolder[]> {
  const params = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
  const res = await fetch(`${API}/api/folders/children${params}`,
    { cache: "no-store", headers: authHeaders(blikonId, phoneNumber) });
  if (!res.ok) throw new Error("Error cargando sub-folders");
  return res.json();
}

export async function getFolderBreadcrumb(id: string, blikonId?: string, phoneNumber?: string): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${API}/api/folders/breadcrumb?id=${encodeURIComponent(id)}`,
    { cache: "no-store", headers: authHeaders(blikonId, phoneNumber) });
  if (!res.ok) return [];
  return res.json();
}

export interface FolderAccess { hasAccess: boolean; exists: boolean; canWrite: boolean; isShared: boolean; }

export async function getFolderAccess(id: string, blikonId?: string, phoneNumber?: string): Promise<FolderAccess> {
  const res = await fetch(`${API}/api/folders/access?id=${encodeURIComponent(id)}`,
    { cache: "no-store", headers: authHeaders(blikonId, phoneNumber) });
  if (!res.ok) return { hasAccess: true, exists: true, canWrite: true, isShared: false };
  return res.json();
}

// Upload chunked — 4MB por bloque
const CHUNK_SIZE = 4 * 1024 * 1024;

// Normaliza un segmento de carpeta igual que el API: solo minúsculas y números
// (sin guiones — el guión es el separador del sistema de direcciones).
function slugSegment(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

export interface UploadItem { file: File; relativePath: string; }

// Ejecuta `worker` sobre `items` con como máximo `concurrency` en paralelo.
async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  async function lane() {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
}

/**
 * Sube una lista de archivos preservando su estructura de carpetas.
 * `relativePath` es la ruta del archivo dentro del folder arrastrado/seleccionado
 * (ej. "miCarpeta/sub/archivo.txt"). Crea los subfolders bajo `baseFolderId`.
 * Asegura los folders primero (secuencial, evita carreras), luego sube los
 * archivos en paralelo (pool de concurrencia) para mayor velocidad.
 */
export async function uploadFolderFiles(
  baseFolderId: string,
  items: UploadItem[],
  onProgress: (done: number, total: number, name: string) => void,
  blikonId?: string,
  phoneNumber?: string,
  concurrency = 5,
): Promise<void> {
  // 1. Calcular el coreFolderId destino de cada archivo
  const targets = items.map(({ file, relativePath }) => {
    const dirSeg  = relativePath.split("/").slice(0, -1).map(slugSegment).filter(Boolean);
    const subPath = dirSeg.join("/");
    return { file, subPath, coreFolderId: subPath ? `${baseFolderId}/${subPath}` : baseFolderId };
  });

  // 2. Asegurar los subfolders únicos PRIMERO (secuencial, evita crear el mismo
  //    folder concurrentemente → duplicados / PK violation). Orden por profundidad
  //    para que los padres existan antes que los hijos.
  const uniqueSubs = [...new Set(targets.map((t) => t.subPath).filter(Boolean))]
    .sort((a, b) => a.split("/").length - b.split("/").length);
  for (const sub of uniqueSubs) {
    await ensureFolder(sub, blikonId, baseFolderId, phoneNumber).catch(() => {});
  }

  // 3. Subir archivos en paralelo
  let done = 0;
  await runPool(targets, concurrency, async (t) => {
    await uploadFile(t.coreFolderId, t.file, () => {}, blikonId, phoneNumber).catch(() => {});
    done++;
    onProgress(done, targets.length, t.file.name);
  });
}

export async function uploadFile(
  coreFolderId: string,
  file: File,
  onProgress: (pct: number) => void,
  blikonId?: string,
  phoneNumber?: string
): Promise<string> {
  const auth = authHeaders(blikonId, phoneNumber);
  const initRes = await fetch(`${API}/api/files/upload/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      coreFolderId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  if (!initRes.ok) throw new Error("No tienes permiso para subir aquí");
  const { id: fileId } = await initRes.json();

  const blockIds: string[] = [];
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const form = new FormData();
    form.append("chunk", chunk, file.name);

    const chunkRes = await fetch(
      `${API}/api/files/upload/${fileId}/chunk?offset=${start}&totalSize=${file.size}`,
      { method: "POST", headers: auth, body: form }
    );
    const { blockId } = await chunkRes.json();
    blockIds.push(blockId);
    onProgress(Math.round(((i + 1) / totalChunks) * 90));
  }

  await fetch(`${API}/api/files/upload/${fileId}/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ blockIds }),
  });

  onProgress(100);
  return fileId;
}
