import { requireSession } from "@/lib/auth";
import { DriveApp } from "../../DriveApp";

// Compat de enlaces directos /folder/{path}: renderiza el DriveApp con ese
// folder como inicial. La navegación interna ya no cambia la URL.
export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string[] }>;
}) {
  const { folderId } = await params;
  const decodedId = folderId.map(decodeURIComponent).join("/");
  const session = await requireSession();

  return <DriveApp session={session} initialFolderId={decodedId} />;
}
