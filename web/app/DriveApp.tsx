"use client";

import { useState, useCallback } from "react";
import { HomeClient } from "./HomeClient";
import { FolderClient } from "./folder/[...folderId]/FolderClient";
import { FileOverlay } from "@/components/FileOverlay";
import { SearchOverlay } from "@/components/SearchOverlay";
import { NavProvider } from "./NavContext";
import type { UserProfile } from "@/lib/auth";
import type { DriveFolder } from "@/lib/api";

// App de un solo "documento": carpetas, archivos y búsqueda son ESTADO interno
// (no cambian la URL del navegador). La ubicación se ve en nuestra AddressBar.
export function DriveApp({
  session,
  initialFolderId,
  initialFolders = [],
}: {
  session: UserProfile;
  initialFolderId: string | null;
  initialFolders?: DriveFolder[];
}) {
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [fileId, setFileId]     = useState<string | null>(null);
  const [search, setSearch]     = useState<string | null>(null);
  // Bump para forzar refresco del folder tras borrar un archivo desde el overlay.
  const [refreshTick, setRefreshTick] = useState(0);

  const openFolder = useCallback((id: string | null) => {
    setFolderId(id);
    setFileId(null);
    setSearch(null);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, []);
  const openFile   = useCallback((id: string | null) => setFileId(id), []);
  const openSearch = useCallback((q: string | null) => setSearch(q && q.trim() ? q : null), []);

  return (
    <NavProvider value={{ openFolder, openFile, openSearch }}>
      {folderId === null ? (
        <HomeClient folders={initialFolders} userInfo={session} />
      ) : (
        <FolderClient key={`${folderId}-${refreshTick}`} folderId={folderId} userInfo={session} />
      )}

      {fileId && (
        <FileOverlay
          fileId={fileId}
          session={session}
          onClose={() => setFileId(null)}
          onDeleted={() => { setFileId(null); setRefreshTick((t) => t + 1); }}
        />
      )}

      {search && (
        <SearchOverlay query={search} session={session} onClose={() => setSearch(null)} />
      )}
    </NavProvider>
  );
}
