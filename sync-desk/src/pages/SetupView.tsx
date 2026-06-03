import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Plus, Trash2, ArrowLeft, User, LogOut, Loader2, FolderSync, Lock } from "lucide-react";
import { AppConfig, SyncFolder, UserInfo } from "../types";

const API_URL = "https://api-blikondrive.com.blog";

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SetupView({
  config,
  userInfo,
  onSave,
  onCancel,
  onLogout,
}: {
  config: AppConfig;
  userInfo: UserInfo | null;
  onSave: (c: AppConfig) => void;
  onCancel: () => void;
  onLogout: () => void;
}) {
  const [folders, setFolders] = useState<SyncFolder[]>(config.syncFolders);
  const [loggingOut, setLoggingOut] = useState(false);
  const [remoteFolders, setRemoteFolders] = useState<string[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  const loadFolders = useCallback(async () => {
    if (!config.blikonId) return;
    setLoadingFolders(true);
    try {
      const ids = await invoke<string[]>("get_remote_folders");
      setRemoteFolders(ids);
    } catch {
      // sin conexión o sin folders todavía
    } finally {
      setLoadingFolders(false);
    }
  }, [config.blikonId]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await invoke("logout");
      onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  async function addFolder() {
    const selected = await open({ directory: true, multiple: false, title: "Selecciona carpeta local" });
    if (!selected || typeof selected !== "string") return;
    const name = selected.split("/").pop() ?? selected;
    setFolders((prev) => [
      ...prev,
      { id: crypto.randomUUID(), localPath: selected, coreFolderId: "", label: name, enabled: true },
    ]);
  }

  function updateFolder(id: string, patch: Partial<SyncFolder>) {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeFolder(id: string) {
    setFolders((prev) => prev.filter((f) => f.id !== id));
  }

  function handleSave() {
    onSave({ apiUrl: API_URL, blikonId: config.blikonId, cronoCode: config.cronoCode, syncFolders: folders });
  }

  const canSave = folders.every((f) => f.localPath && f.coreFolderId.trim());

  return (
    <div className="flex flex-col h-screen bg-[#f6f8fc]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#dadce0]">
        <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f6f8fc]">
          <ArrowLeft size={16} className="text-[#444746]" />
        </button>
        <span className="text-sm font-medium text-[#202124]">Configuración</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Cuenta conectada */}
        {userInfo && (
          <section className="bg-white rounded-xl border border-[#dadce0] p-4 flex flex-col gap-2">
            <p className="text-xs font-medium text-[#444746] uppercase tracking-wide">Cuenta</p>
            <div className="flex items-center gap-3">
              {userInfo.photo ? (
                <img src={userInfo.photo} alt={userInfo.profileName} className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#1a73e8] flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#202124] truncate">{userInfo.profileName}</p>
                <p className="text-xs text-[#444746] truncate">{userInfo.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#444746]">Crono Code:</span>
                <span className="text-xs font-mono text-[#202124] bg-[#f6f8fc] px-2 py-0.5 rounded">{userInfo.cronoCode}</span>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                <LogOut size={12} />
                {loggingOut ? "Cerrando…" : "Cerrar sesión"}
              </button>
            </div>
          </section>
        )}

        {/* Carpetas */}
        <section className="bg-white rounded-xl border border-[#dadce0] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#444746] uppercase tracking-wide">Carpetas sincronizadas</p>
            <button
              onClick={addFolder}
              className="flex items-center gap-1 text-xs text-[#1a73e8] font-medium hover:underline"
            >
              <Plus size={13} /> Agregar
            </button>
          </div>

          {folders.length === 0 && (
            <button
              onClick={addFolder}
              className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-[#dadce0] rounded-xl text-[#444746] hover:border-[#1a73e8] hover:text-[#1a73e8] transition-colors"
            >
              <FolderOpen size={28} strokeWidth={1} />
              <span className="text-sm">Seleccionar carpeta local</span>
            </button>
          )}

          {folders.map((f) => (
            <div key={f.id} className="border border-[#dadce0] rounded-xl p-3 flex flex-col gap-2">
              {/* Ruta local + botón eliminar */}
              <div className="flex items-center gap-2">
                <FolderOpen size={16} className="text-[#1a73e8] shrink-0" />
                <p className="text-sm text-[#202124] truncate flex-1 font-mono text-xs">{f.localPath}</p>
                <button
                  onClick={() => removeFolder(f.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50"
                  title="Quitar de sincronización"
                >
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>

              {/* Folder en Drive — bloqueado si ya está asignado */}
              {f.coreFolderId ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#444746]">Folder en Drive</span>
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#f0f4ff] border border-[#c2d7ff] rounded-lg">
                    <FolderSync size={14} className="text-[#1a73e8] shrink-0" />
                    <span className="text-sm font-mono text-[#1a73e8] flex-1">{f.coreFolderId}</span>
                    <Lock size={12} className="text-[#9aa0a6] shrink-0" title="Para cambiar, elimina esta entrada y agrégala de nuevo" />
                  </div>
                </div>
              ) : (
                <FolderPicker
                  value={f.coreFolderId}
                  onChange={(v) => updateFolder(f.id, { coreFolderId: v })}
                  remoteFolders={remoteFolders}
                  loading={loadingFolders}
                />
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`enabled-${f.id}`}
                  checked={f.enabled}
                  onChange={(e) => updateFolder(f.id, { enabled: e.target.checked })}
                  className="accent-[#1a73e8]"
                />
                <label htmlFor={`enabled-${f.id}`} className="text-xs text-[#444746]">Sincronización activa</label>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 bg-white border-t border-[#dadce0]">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-[#444746] hover:bg-[#f6f8fc] rounded-full">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-full hover:bg-[#1557b0] disabled:opacity-40 transition-colors"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function FolderPicker({ value, onChange, remoteFolders, loading }: {
  value: string;
  onChange: (v: string) => void;
  remoteFolders: string[];
  loading: boolean;
}) {
  const isNew = value.trim() !== "" && !remoteFolders.includes(value);

  function handleInput(raw: string) {
    onChange(slugify(raw));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-[#444746]">Folder en Drive</label>

      {/* Input con auto-slug */}
      <input
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        placeholder="obra-carpinteria"
        className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg bg-[#f6f8fc] font-mono
          focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
      />

      {/* Indicador de nuevo folder */}
      {isNew && (
        <p className="text-xs text-[#1a73e8]">
          Se creará el folder <span className="font-mono font-medium">"{value}"</span> al sincronizar
        </p>
      )}

      {/* Folders existentes */}
      <div className="flex flex-col gap-1">
        {loading ? (
          <div className="flex items-center gap-1.5 py-1">
            <Loader2 size={12} className="animate-spin text-[#9aa0a6]" />
            <span className="text-xs text-[#9aa0a6]">Cargando folders…</span>
          </div>
        ) : remoteFolders.length > 0 ? (
          <>
            <p className="text-xs text-[#9aa0a6]">Folders existentes:</p>
            <div className="flex flex-wrap gap-1.5">
              {remoteFolders.map((fid) => (
                <button
                  key={fid}
                  type="button"
                  onClick={() => onChange(fid)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono transition-colors
                    ${value === fid
                      ? "bg-[#1a73e8] text-white"
                      : "bg-[#f0f4ff] text-[#1a73e8] hover:bg-[#d2e3fc]"
                    }`}
                >
                  <FolderSync size={10} />
                  {fid}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-[#9aa0a6]">Sin folders en la cuenta — escribe uno nuevo arriba (ej: <span className="font-mono">obra-carpinteria</span>)</p>
        )}
      </div>
    </div>
  );
}
