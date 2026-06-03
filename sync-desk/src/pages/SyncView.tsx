import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, RefreshCw, Pause, Play, FolderSync, CheckCircle2, AlertCircle, Loader2, Clock, Trash2 } from "lucide-react";
import { AppConfig, SyncEntry, UserInfo } from "../types";

function statusIcon(status: SyncEntry["status"], progress: number) {
  switch (status) {
    case "synced":    return <CheckCircle2 size={16} className="text-green-500 shrink-0" />;
    case "error":     return <AlertCircle size={16} className="text-red-500 shrink-0" />;
    case "uploading": return <Loader2 size={16} className="text-[#1a73e8] shrink-0 animate-spin" />;
    default:          return <Clock size={16} className="text-gray-400 shrink-0" />;
  }
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function UserAvatar({ userInfo }: { userInfo: UserInfo | null }) {
  if (!userInfo) return null;
  const initial = (userInfo.firstName || userInfo.profileName || "B")[0].toUpperCase();
  return userInfo.photo ? (
    <img
      src={userInfo.photo}
      alt={userInfo.profileName}
      className="w-7 h-7 rounded-full object-cover"
      title={`${userInfo.profileName} · ${userInfo.cronoCode}`}
    />
  ) : (
    <div
      className="w-7 h-7 rounded-full bg-[#1a73e8] flex items-center justify-center text-white text-xs font-semibold"
      title={`${userInfo.profileName} · ${userInfo.cronoCode}`}
    >
      {initial}
    </div>
  );
}

export function SyncView({
  config,
  entries,
  userInfo,
  onOpenSetup,
}: {
  config: AppConfig;
  entries: SyncEntry[];
  userInfo: UserInfo | null;
  onOpenSetup: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function clearHistory() {
    setClearing(true);
    try {
      await invoke("clear_sync_entries");
      // El listener sync_entry_updated manejará el estado — vaciamos localmente
      window.location.reload();
    } finally {
      setClearing(false);
    }
  }

  async function triggerSync() {
    setSyncing(true);
    try { await invoke("trigger_sync"); } finally { setSyncing(false); }
  }

  async function togglePause() {
    await invoke(paused ? "resume_sync" : "pause_sync");
    setPaused((p) => !p);
  }

  const pending  = entries.filter((e) => e.status === "pending").length;
  const uploading = entries.filter((e) => e.status === "uploading").length;
  const errors   = entries.filter((e) => e.status === "error").length;
  const synced   = entries.filter((e) => e.status === "synced").length;

  return (
    <div className="flex flex-col h-screen bg-[#f6f8fc] select-none">
      {/* Title bar / Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#dadce0] drag-region">
        <div className="flex items-center gap-2 flex-1">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="#1a73e8"/>
            <path d="M22.5 14.2A4.5 4.5 0 0 0 14.1 12a3 3 0 0 0-3.6 2.9A3.5 3.5 0 0 0 11 22h11a3 3 0 0 0 .5-5.8z" fill="white" opacity="0.9"/>
            <path d="M16 18v5M13.5 20.5 16 18l2.5 2.5" stroke="#1a73e8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm font-medium text-[#202124]">Blikon Sync</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={togglePause}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f6f8fc] transition-colors"
            title={paused ? "Reanudar" : "Pausar"}
          >
            {paused ? <Play size={15} className="text-[#444746]" /> : <Pause size={15} className="text-[#444746]" />}
          </button>
          <button
            onClick={triggerSync}
            disabled={syncing || paused}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f6f8fc] transition-colors disabled:opacity-40"
            title="Sincronizar ahora"
          >
            <RefreshCw size={15} className={`text-[#444746] ${syncing ? "animate-spin" : ""}`} />
          </button>
          {entries.length > 0 && (
            <button
              onClick={clearHistory}
              disabled={clearing}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors disabled:opacity-40"
              title="Limpiar historial de sync"
            >
              <Trash2 size={14} className="text-[#a0a0a0]" />
            </button>
          )}
          <button
            onClick={onOpenSetup}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f6f8fc] transition-colors"
            title="Configuración"
          >
            <Settings size={15} className="text-[#444746]" />
          </button>
          <UserAvatar userInfo={userInfo} />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-[#dadce0] text-xs text-[#444746]">
        {uploading > 0 && (
          <span className="flex items-center gap-1 text-[#1a73e8] font-medium">
            <Loader2 size={12} className="animate-spin" /> Subiendo {uploading}
          </span>
        )}
        {pending > 0 && <span>{pending} pendiente{pending > 1 ? "s" : ""}</span>}
        {errors > 0 && <span className="text-red-500">{errors} error{errors > 1 ? "es" : ""}</span>}
        {synced > 0 && <span className="text-green-600">{synced} sincronizado{synced > 1 ? "s" : ""}</span>}
        {paused && <span className="text-orange-500 font-medium">⏸ Pausado</span>}
        {entries.length === 0 && <span>Sin actividad reciente</span>}
      </div>

      {/* Folders configurados */}
      {config.syncFolders.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-[#444746]">
          <FolderSync size={52} strokeWidth={0.8} className="text-[#dadce0]" />
          <div className="text-center">
            <p className="font-medium text-[#202124]">Sin carpetas configuradas</p>
            <p className="text-sm mt-1">Agrega una carpeta local para empezar a sincronizar</p>
          </div>
          <button
            onClick={onOpenSetup}
            className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-full hover:bg-[#1557b0] transition-colors"
          >
            Configurar carpeta
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Lista de entradas de sync */}
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#444746] gap-2">
              <CheckCircle2 size={32} strokeWidth={1} className="text-green-400" />
              <p className="text-sm">Todo sincronizado</p>
            </div>
          ) : (
            <div className="divide-y divide-[#f0f0f0]">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white transition-colors">
                  {statusIcon(entry.status, entry.progress)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#202124] truncate">{entry.fileName}</p>
                    <p className="text-xs text-[#444746]">{formatBytes(entry.sizeBytes)}</p>
                    {entry.status === "uploading" && (
                      <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden w-full">
                        <div
                          className="h-full bg-[#1a73e8] rounded-full transition-all duration-300"
                          style={{ width: `${entry.progress}%` }}
                        />
                      </div>
                    )}
                    {entry.error && (
                      <p className="text-xs text-red-500 mt-0.5 truncate">{entry.error}</p>
                    )}
                  </div>
                  <span className="text-xs text-[#444746] shrink-0">
                    {entry.status === "uploading" ? `${entry.progress}%` : entry.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
