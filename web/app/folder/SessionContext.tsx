"use client";

import { createContext, useContext } from "react";
import type { UserProfile } from "@/lib/auth";

const SessionContext = createContext<UserProfile | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: UserProfile;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): UserProfile {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession debe usarse dentro de SessionProvider");
  return s;
}
