"use client";

import { useState, useCallback, useEffect } from "react";
import { HomeClient } from "./HomeClient";
import { FolderClient } from "./folder/[...folderId]/FolderClient";
import { FileOverlay } from "@/components/FileOverlay";
import { SearchOverlay } from "@/components/SearchOverlay";
import { NavProvider } from "./NavContext";
import { folderIdFromHost } from "@/lib/utils";
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

  // Entrada por subdominio drive-{crono}-{path}.com.blog → folder inicial.
  // En Netlify el host del server es siempre "drive.com.blog" (normaliza el
  // wildcard), así que el subdominio real solo lo conoce el navegador. Lo
  // resolvemos aquí, en el cliente, al montar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromHost = folderIdFromHost(window.location.host);
    if (fromHost && fromHost !== initialFolderId) setFolderId(fromHost);
    // Solo al montar: la navegación posterior es por estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
