import type { UploadItem } from "./api";

// Tipos mínimos del API FileSystemEntry (webkitGetAsEntry) — no está en lib.dom estándar.
interface FSEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (cb: (f: File) => void, err?: (e: unknown) => void) => void;
  createReader?: () => { readEntries: (cb: (e: FSEntry[]) => void, err?: (e: unknown) => void) => void };
}

function entryFile(entry: FSEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file!(resolve, reject));
}

function readAllEntries(reader: { readEntries: (cb: (e: FSEntry[]) => void, err?: (e: unknown) => void) => void }): Promise<FSEntry[]> {
  return new Promise((resolve) => {
    const all: FSEntry[] = [];
    const read = () => reader.readEntries((entries) => {
      if (entries.length === 0) resolve(all);
      else { all.push(...entries); read(); }
    }, () => resolve(all));
    read();
  });
}

async function traverse(entry: FSEntry, parentPath: string, out: UploadItem[]) {
  if (entry.isFile) {
    const file = await entryFile(entry);
    out.push({ file, relativePath: parentPath + file.name });
  } else if (entry.isDirectory && entry.createReader) {
    const dirPath = parentPath + entry.name + "/";
    const children = await readAllEntries(entry.createReader());
    for (const c of children) await traverse(c, dirPath, out);
  }
}

/**
 * Extrae todos los archivos (con su ruta relativa) de un drop, soportando
 * carpetas anidadas vía webkitGetAsEntry. Fallback a dataTransfer.files si
 * el navegador no soporta entries.
 */
export async function readDroppedItems(dt: DataTransfer): Promise<UploadItem[]> {
  const out: UploadItem[] = [];

  // Captura síncrona de las entries (los items se invalidan al terminar el handler).
  const entries: FSEntry[] = [];
  if (dt.items && dt.items.length) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i] as DataTransferItem & { webkitGetAsEntry?: () => FSEntry | null };
      const entry = item.webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
  }

  if (entries.length) {
    for (const e of entries) await traverse(e, "", out);
    return out;
  }

  // Fallback: solo archivos sueltos
  for (const file of Array.from(dt.files)) {
    out.push({ file, relativePath: file.name });
  }
  return out;
}
