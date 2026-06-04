"use client";

import { useParams } from "next/navigation";
import { FolderClient } from "./FolderClient";
import { useSession } from "../SessionContext";

export default function FolderPage() {
  const session = useSession();
  const params  = useParams<{ folderId: string[] }>();
  const segments = Array.isArray(params.folderId) ? params.folderId : [params.folderId];
  const folderId = segments.map(decodeURIComponent).join("/");

  return <FolderClient folderId={folderId} userInfo={session} />;
}
