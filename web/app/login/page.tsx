import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BlikonDriveLogo } from "@/components/BlikonDriveLogo";
import { LoginButtons } from "./LoginButtons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  // Si ya hay sesión válida → redirigir de vuelta
  const session = await getSession();
  if (session) {
    const { return: returnPath } = await searchParams;
    redirect(returnPath ?? "/");
  }

  const { return: returnPath } = await searchParams;
  const isDev  = process.env.NODE_ENV === "development";
  // En prod usar NEXT_PUBLIC_APP_URL, en dev localhost:3000
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f8fc]">
      <div className="w-full max-w-sm flex flex-col items-center gap-8 px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <BlikonDriveLogo size={56} />
          <div className="text-center">
            <h1 className="text-2xl font-medium text-[#202124]">Blikon Drive</h1>
            <p className="text-sm text-[#444746] mt-1">Almacenamiento en la nube</p>
          </div>
        </div>

        {/* Card */}
        <div className="w-full bg-white rounded-2xl border border-[#dadce0] shadow-sm p-8 flex flex-col gap-5">
          <div className="text-center">
            <h2 className="text-lg font-medium text-[#202124]">Iniciar sesión</h2>
            <p className="text-sm text-[#444746] mt-1">
              Usa tu cuenta Blikon para acceder
            </p>
          </div>

          <LoginButtons isDev={isDev} returnPath={returnPath ?? "/"} appUrl={appUrl} />
        </div>

        {isDev && (
          <p className="text-xs font-mono text-[#9aa0a6] bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-center">
            Modo desarrollo — sesión simulada
          </p>
        )}

        <p className="text-xs text-[#9aa0a6]">
          © {new Date().getFullYear()} Blikon
        </p>
      </div>
    </div>
  );
}
