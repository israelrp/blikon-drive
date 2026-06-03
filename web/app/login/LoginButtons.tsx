"use client";

export function LoginButtons({
  isDev,
  returnPath,
  appUrl,
}: {
  isDev:      boolean;
  returnPath: string;
  appUrl:     string;           // origen de la app, ej: http://localhost:3000
}) {
  async function loginAsDev() {
    await fetch("/api/auth/dev-login", { method: "POST" });
    window.location.href = returnPath;
  }

  if (isDev) {
    return (
      <button
        onClick={loginAsDev}
        className="flex items-center justify-center gap-3 w-full h-11 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-full transition-colors"
      >
        ⚡ Entrar como Dev User
      </button>
    );
  }

  // ValidaCel redirigirá al usuario a appUrl después del login
  const loginHref = `https://validacel.com.blog?origin=${encodeURIComponent(appUrl)}`;

  return (
    <a
      href={loginHref}
      className="flex items-center justify-center gap-3 w-full h-11 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm font-medium rounded-full transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.8" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      Continuar con ValidaCel
    </a>
  );
}
