"use client";

import { createContext, useContext } from "react";

export interface NavApi {
  // Navega a un folder (null = raíz/Mi Drive). En el SPA cambia estado interno
  // sin tocar la URL del navegador.
  openFolder: (folderId: string | null) => void;
  // Abre el detalle de un archivo como overlay (null = cierra).
  openFile: (fileId: string | null) => void;
  // Abre la búsqueda como overlay (null/"" = cierra).
  openSearch: (query: string | null) => void;
}

// Default: navegación por URL (fallback para componentes fuera del DriveApp).
const NavContext = createContext<NavApi>({
  openFolder: (folderId) => {
    if (typeof window !== "undefined") window.location.assign(folderId ? `/folder/${folderId}` : "/");
  },
  openFile: (fileId) => {
    if (typeof window !== "undefined" && fileId) window.location.assign(`/file/${fileId}`);
  },
  openSearch: (query) => {
    if (typeof window !== "undefined" && query) window.location.assign(`/search?q=${encodeURIComponent(query)}`);
  },
});

export const NavProvider = NavContext.Provider;
export function useNav(): NavApi {
  return useContext(NavContext);
}
