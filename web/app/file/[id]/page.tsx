import { getFileById } from "@/lib/api";
import { FileDetailClient } from "./FileDetailClient";

export default async function FilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const file = await getFileById(id);

  return <FileDetailClient file={file} folderId={file.coreFolderId} />;
}
