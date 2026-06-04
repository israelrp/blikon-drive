import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function LoginView() {
  const [opening, setOpening] = useState(false);

  async function handleLogin() {
    setOpening(true);
    try {
      await invoke("open_login_window");
    } finally {
      setOpening(false);
    }
  }

  async function handleOpenDevtools() {
    await invoke("open_login_devtools").catch(() => {});
  }

  return (
    <div className="flex flex-col h-screen bg-[#f6f8fc] items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-3">
        <svg width="56" height="56" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="8" fill="#1a73e8" />
          <path d="M22.5 14.2A4.5 4.5 0 0 0 14.1 12a3 3 0 0 0-3.6 2.9A3.5 3.5 0 0 0 11 22h11a3 3 0 0 0 .5-5.8z" fill="white" opacity="0.9" />
          <path d="M16 18v5M13.5 20.5 16 18l2.5 2.5" stroke="#1a73e8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h1 className="text-base font-semibold text-[#202124]">Blikon Sync</h1>
      </div>

      <div className="text-center max-w-[260px]">
        <p className="text-sm text-[#444746] leading-relaxed">
          Inicia sesión con tu cuenta Blikon para sincronizar tus archivos
        </p>
      </div>

      <button
        onClick={handleLogin}
        disabled={opening}
        className="flex items-center gap-2 px-6 py-2.5 bg-[#1a73e8] text-white text-sm font-medium rounded-full hover:bg-[#1557b0] disabled:opacity-60 transition-colors"
      >
        {opening ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.8" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
        Iniciar sesión con ValidaCel
      </button>

      {/* Botón de diagnóstico — abre DevTools de la ventana de login */}
      <button
        onClick={handleOpenDevtools}
        className="text-xs text-[#c0c0c0] hover:text-[#888] mt-4"
        title="Abrir diagnóstico de la ventana de login"
      >
        diagnóstico
      </button>
    </div>
  );
}
