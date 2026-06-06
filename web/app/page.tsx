import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { getFolderChildren } from "@/lib/api";
import { folderIdFromHost } from "@/lib/utils";
import { DriveApp } from "./DriveApp";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const session = await requireSession();
  const { folder } = await searchParams;

  // Entrada por subdominio drive-{crono}-{path}.com.blog → folder inicial.
  // Se resuelve server-side: en Netlify el header `host` del middleware Edge no
  // es fiable (a veces es el host interno), aquí sí lo es. Probamos
  // x-forwarded-host (cuando hay proxy) y luego host.
  const h = await headers();
  const initialFolderId =
    folderIdFromHost(h.get("x-forwarded-host")) ??
    folderIdFromHost(h.get("host")) ??
    folder ??
    null;

  // Folders raíz para el primer render (la app los refresca client-side).
  const folders = await getFolderChildren(undefined, session.blikonId, session.phoneNumber).catch(() => []);

  return <DriveApp session={session} initialFolderId={initialFolderId} initialFolders={folders} />;
}
