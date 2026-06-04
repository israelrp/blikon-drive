import { requireSession } from "@/lib/auth";
import { FolderClient } from "./FolderClient";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string[] }>;
}) {
  const { folderId } = await params;
  const decodedId = folderId.map(decodeURIComponent).join("/");

  // Solo resolvemos la sesión (rápido). Los datos del folder se cargan
  // client-side para que la navegación sea instantánea.
  const session = await requireSession();

  return <FolderClient folderId={decodedId} userInfo={session} />;
}
