"use client";

import { useState, useCallback } from "react";
import { HomeClient } from "./HomeClient";
import { FolderClient } from "./folder/[...folderId]/FolderClient";
import { NavProvider } from "./NavContext";
import type { UserProfile } from "@/lib/auth";
import type { DriveFolder } from "@/lib/api";

// App de un solo "documento": la navegación entre carpetas es por ESTADO interno
// (no cambia la URL del navegador). La ubicación se muestra en nuestra AddressBar.
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
  const openFolder = useCallback((id: string | null) => {
    setFolderId(id);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, []);

  return (
    <NavProvider value={{ openFolder }}>
      {folderId === null ? (
        <HomeClient folders={initialFolders} userInfo={session} />
      ) : (
        <FolderClient key={folderId} folderId={folderId} userInfo={session} />
      )}
    </NavProvider>
  );
}
