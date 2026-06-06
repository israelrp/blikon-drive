import { requireSession } from "@/lib/auth";
import { getFolderChildren } from "@/lib/api";
import { DriveApp } from "./DriveApp";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const session = await requireSession();
  const { folder } = await searchParams;
  // El middleware reescribe el subdominio drive-{crono}-path a /?folder=path.
  const initialFolderId = folder ?? null;
  // Folders raíz para el primer render (la app los refresca client-side).
  const folders = await getFolderChildren(undefined, session.blikonId, session.phoneNumber).catch(() => []);

  return <DriveApp session={session} initialFolderId={initialFolderId} initialFolders={folders} />;
}
