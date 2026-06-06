"use client";

import { createContext, useContext } from "react";

export interface NavApi {
  // Navega a un folder (null = raíz/Mi Drive). En el SPA cambia estado interno
  // sin tocar la URL del navegador.
  openFolder: (folderId: string | null) => void;
}

// Default: navegación por URL (fallback para componentes fuera del DriveApp,
// p.ej. resultados de búsqueda). Dentro del DriveApp se sobrescribe con estado.
const NavContext = createContext<NavApi>({
  openFolder: (folderId) => {
    if (typeof window !== "undefined") {
      window.location.assign(folderId ? `/folder/${folderId}` : "/");
    }
  },
});

export const NavProvider = NavContext.Provider;
export function useNav(): NavApi {
  return useContext(NavContext);
}
