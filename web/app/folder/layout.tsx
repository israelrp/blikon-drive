import { requireSession } from "@/lib/auth";
import { SessionProvider } from "./SessionContext";

// La sesión se valida UNA vez al entrar a la sección /folder. Este layout se
// preserva al navegar entre folders, así no se re-valida el token en cada
// navegación (antes era el cuello de botella: un fetch a /api/auth/check por folder).
export default async function FolderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
