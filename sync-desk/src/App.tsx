import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { SyncView } from "./pages/SyncView";
import { SetupView } from "./pages/SetupView";
import { LoginView } from "./pages/LoginView";
import { AppConfig, SyncEntry, AuthState, UserInfo } from "./types";

const DEFAULT_CONFIG: AppConfig = {
  apiUrl: "http://localhost:5086",
  blikonId: "",
  syncFolders: [],
};

export default function App() {
  const [config, setConfig]     = useState<AppConfig>(DEFAULT_CONFIG);
  const [entries, setEntries]   = useState<SyncEntry[]>([]);
  const [view, setView]         = useState<"sync" | "setup">("sync");
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  async function persistAndEnter(info: UserInfo) {
    setUserInfo(info);
    setAuthState("authenticated");
    try {
      await invoke("save_user_profile", { profile: info });
      const cfg = await invoke<AppConfig>("get_config");
      setConfig(cfg);
    } catch (e) {
      console.error("[Auth] save_user_profile:", e);
    }
  }

  useEffect(() => {
    // Arrancar con sesión guardada si existe (sin ninguna llamada a red)
    invoke<AppConfig>("get_config").then((cfg) => {
      setConfig(cfg);
      if (cfg.blikonId && !cfg.blikonId.startsWith("dev-") && cfg.userProfile) {
        setUserInfo(cfg.userProfile);
        setAuthState("authenticated");
      } else {
        setAuthState("unauthenticated");
      }
    }).catch(() => setAuthState("unauthenticated"));

    invoke<SyncEntry[]>("get_entries").then(setEntries).catch(() => {});

    // Actualizaciones de sync en tiempo real
    const unlistenEntry = listen<SyncEntry>("sync_entry_updated", (e) => {
      setEntries((prev) => {
        const idx = prev.findIndex((x) => x.id === e.payload.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = e.payload; return next; }
        return [e.payload, ...prev];
      });
    });

    // auth_success viene del servidor local Rust después de que el bridge script
    // llama a ValidaCel API (contexto validacel.com.blog, sin CORS) y hace POST al
    // servidor local. Payload: JSON string con UserInfo.
    const unlistenSuccess = listen<string>("auth_success", async (e) => {
      console.log("[Auth] auth_success recibido:", e.payload);
      try {
        const info: UserInfo = JSON.parse(e.payload);
        await persistAndEnter(info);
      } catch (err) {
        console.error("[Auth] parse error:", err);
      }
    });

    // Fallback: si el usuario cierra la ventana sin completar el flujo
    const unlistenClosed = listen("login_window_closed", () => {
      console.log("[Auth] login_window_closed (sin auth_success)");
      // No hacemos fetch CORS — dejamos al usuario volver a intentar
      setAuthState((prev) => prev === "checking" ? "unauthenticated" : prev);
    });

    return () => {
      unlistenEntry.then((f) => f());
      unlistenSuccess.then((f) => f());
      unlistenClosed.then((f) => f());
    };
  }, []);

  async function saveConfig(next: AppConfig) {
    await invoke("save_config", { config: next });
    setConfig(next);
    setView("sync");
  }

  if (authState === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f6f8fc]">
        <div className="w-8 h-8 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <LoginView />;
  }

  function handleLogout() {
    setUserInfo(null);
    setAuthState("unauthenticated");
    setEntries([]);
    setView("sync");
  }

  return view === "setup" ? (
    <SetupView config={config} userInfo={userInfo} onSave={saveConfig} onCancel={() => setView("sync")} onLogout={handleLogout} />
  ) : (
    <SyncView config={config} entries={entries} userInfo={userInfo} onOpenSetup={() => setView("setup")} />
  );
}
