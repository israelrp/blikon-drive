"use client";

import { useEffect } from "react";

// Tras cargar, cachea el perfil validado en la cookie blikon_profile (vía
// /api/auth/warm) para que los refrescos siguientes sean instantáneos.
// No bloquea nada — es fire-and-forget.
export function SessionWarmer() {
  useEffect(() => {
    fetch("/api/auth/warm", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
