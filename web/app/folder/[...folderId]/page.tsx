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

  const [session] = await Promise.all([requireSession()]);

  await ensureFolder(decodedId).catch(() => null);

  const [files, subfolders, breadcrumb] = await Promise.all([
    getFilesByFolder(decodedId),
    getFolderChildren(decodedId),
    getFolderBreadcrumb(decodedId),
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
