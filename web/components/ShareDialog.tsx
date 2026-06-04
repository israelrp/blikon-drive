"use client";

import { useState, useEffect, useCallback } from "react";
import { X, UserPlus, Trash2, Phone, Loader2, Check } from "lucide-react";
import {
  FolderShare, SharePermission,
  getFolderShares, shareFolder, unshareFolder,
} from "@/lib/api";

export function ShareDialog({
  folderId,
  folderName,
  blikonId,
  onClose,
}: {
  folderId: string;
  folderName: string;
  blikonId?: string;
  onClose: () => void;
}) {
  const [shares, setShares]       = useState<FolderShare[]>([]);
  const [loading, setLoading]     = useState(true);
  const [phone, setPhone]         = useState("");
  const [permission, setPermission] = useState<SharePermission>("viewer");
  const [sharing, setSharing]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await getFolderShares(folderId, blikonId);
    setShares(s);
    setLoading(false);
  }, [folderId, blikonId]);

  useEffect(() => { load(); }, [load]);

  const digits = phone.replace(/\D/g, "");
  const canShare = digits.length >= 10 && !sharing;

  async function handleShare() {
    if (!canShare) return;
    setSharing(true);
    setError(null);
    try {
      await shareFolder(folderId, digits, permission, blikonId);
      setPhone("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al compartir");
    } finally {
      setSharing(false);
    }
  }

  async function handleRemove(id: string) {
    await unshareFolder(id, blikonId);
    setShares((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-[#202124]">Compartir folder</h2>
            <p className="text-xs text-[#9aa0a6] truncate max-w-[300px]">{folderName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f6f8fc]">
            <X size={16} className="text-[#444746]" />
          </button>
        </div>

        {/* Agregar persona por teléfono */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[#444746]">Compartir con (teléfono: código país + 10 dígitos)</label>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 flex-1 px-3 border border-[#dadce0] rounded-lg focus-within:ring-2 focus-within:ring-[#1a73e8]">
              <Phone size={15} className="text-[#9aa0a6] shrink-0" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleShare()}
                placeholder="52 1234567890"
                className="flex-1 py-2 text-sm bg-transparent outline-none"
              />
            </div>
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as SharePermission)}
              className="px-2 text-sm border border-[#dadce0] rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#1a73e8]"
            >
              <option value="viewer">Lector</option>
              <option value="editor">Editor</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleShare}
            disabled={!canShare}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-full hover:bg-[#1557b0] disabled:opacity-40 transition-colors"
          >
            {sharing ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            Compartir
          </button>
        </div>

        {/* Lista de personas con acceso */}
        <div className="flex flex-col gap-1 border-t border-[#e8eaed] pt-3">
          <p className="text-xs font-medium text-[#444746] uppercase tracking-wide mb-1">Con acceso</p>
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-[#9aa0a6]">
              <Loader2 size={14} className="animate-spin" /> <span className="text-sm">Cargando…</span>
            </div>
          ) : shares.length === 0 ? (
            <p className="text-sm text-[#9aa0a6] py-2">Aún no compartes este folder con nadie.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
              {shares.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#f6f8fc]">
                  <div className="w-8 h-8 rounded-full bg-[#e8f0fe] flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-[#1a73e8]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#202124] font-mono truncate">+{s.phoneNumber}</p>
                    <p className="text-xs text-[#9aa0a6] flex items-center gap-1">
                      <Check size={10} /> {s.permission === "editor" ? "Editor" : "Lector"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(s.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50"
                    title="Quitar acceso"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
