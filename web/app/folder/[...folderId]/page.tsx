import { getFilesByFolder, getFolderChildren, getFolderBreadcrumb, ensureFolder } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { FolderClient } from "./FolderClient";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string[] }>;
}) {
  const { folderId } = await params;
  const decodedId = folderId.map(decodeURIComponent).join("/");

  const session = await requireSession();

  await ensureFolder(decodedId, session.blikonId).catch(() => null);

  const [files, subfolders, breadcrumb] = await Promise.all([
    getFilesByFolder(decodedId, session.blikonId),
    getFolderChildren(decodedId, session.blikonId),
    getFolderBreadcrumb(decodedId, session.blikonId),
  ]);

  return (
    <FolderClient
      folderId={decodedId}
      initialFiles={files}
      initialSubfolders={subfolders}
      breadcrumb={breadcrumb}
      userInfo={session}
    />
  );
}
