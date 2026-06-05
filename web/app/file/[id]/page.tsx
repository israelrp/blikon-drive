import { getFileById } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { FileDetailClient } from "./FileDetailClient";

export default async function FilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [file, session] = await Promise.all([getFileById(id), requireSession()]);

  return (
    <FileDetailClient
      file={file}
      folderId={file.coreFolderId}
      blikonId={session.blikonId}
      phoneNumber={session.phoneNumber}
    />
  );
}
