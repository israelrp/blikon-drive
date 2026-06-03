"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FolderOpen, Plus, X, AlertCircle } from "lucide-react";
import { DriveHeader } from "@/components/DriveHeader";
import { ensureFolder, DriveFolder } from "@/lib/api";

interface UserInfo {
  blikonId: string; cronoCode: string; profileName: string; email: string; photo: string;
}

// Reglas: minúsculas, letras, números y guiones. Empieza con letra o número.
const FOLDER_RE = /^[a-z0-9][a-z0-9-]*$/;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")          // espacios → guión
    .replace(/[^a-z0-9-]/g, "")   // eliminar caracteres no permitidos
    .replace(/-+/g, "-")           // guiones múltiples → uno
    .replace(/^-|-$/g, "");        // quitar guiones al inicio/fin
}

function validateName(name: string): string | null {
  if (!name) return "El nombre es requerido";
  if (name.length < 2) return "Mínimo 2 caracteres";
  if (name.length > 50) return "Máximo 50 caracteres";
  if (!FOLDER_RE.test(name)) return "Solo minúsculas, números y guiones";
  return null;
}

export function HomeClient({
  folders: initial,
  userInfo,
}: {
  folders: DriveFolder[];
  userInfo: UserInfo;
}) {
  const router = useRouter();
  const [folders, setFolders] = useState(initial);
  const [view, setView]       = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState(false);
  const [input, setInput]     = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const slug = slugify(input);

  function handleInput(v: string) {
    setInput(v);
    setError(validateName(slugify(v)));
  }

  async function handleCreate() {
    const name = slug;
    const err = validateName(name);
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const folder = await ensureFolder(name, userInfo.blikonId);
      setFolders((prev) => prev.some((f) => f.id === folder.id) ? prev : [folder, ...prev]);
      setCreating(false);
      setInput("");
      router.push(`/folder/${name}`);
    } catch {
      setError("No se pudo crear el folder");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      <DriveHeader view={view} onViewChange={setView} userInfo={userInfo} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Título + botón nuevo */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-medium text-[#202124]">Mis folders</h1>
          <button
            onClick={() => { setCreating(true); setInput(""); setError(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-full hover:bg-[#1557b0] transition-colors"
          >
            <Plus size={15} />
            Nuevo folder
          </button>
        </div>

        {/* Modal crear folder */}
        {creating && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium text-[#202124]">Nuevo folder</h2>
                <button onClick={() => setCreating(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f6f8fc]">
                  <X size={16} className="text-[#444746]" />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#444746]">Nombre del folder</label>
                <input
                  autoFocus
                  value={input}
                  onChange={(e) => handleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="mi-proyecto"
                  className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
                />
                {/* Preview del slug */}
                {slug && (
                  <p className="text-xs text-[#444746] mt-1">
                    URL: <span className="font-mono text-[#1a73e8]">drive-{userInfo.cronoCode}-{slug}.com.blog</span>
                  </p>
                )}
                {error && (
                  <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}
                <p className="text-xs text-[#9aa0a6] mt-1">
                  Solo minúsculas, números y guiones. Ej: <span className="font-mono">mi-proyecto</span>
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setCreating(false)}
                  className="px-4 py-2 text-sm text-[#444746] hover:bg-[#f6f8fc] rounded-full"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!slug || !!error || loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-full hover:bg-[#1557b0] disabled:opacity-40 transition-colors"
                >
                  {loading ? "Creando…" : "Crear"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de folders */}
        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#444746]">
            <FolderOpen size={64} strokeWidth={0.8} className="text-[#dadce0] mb-4" />
            <p className="font-medium text-[#202124]">Sin folders todavía</p>
            <p className="text-sm mt-1">Crea tu primer folder para empezar a guardar archivos</p>
            <button
              onClick={() => setCreating(true)}
              className="mt-4 px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-full hover:bg-[#1557b0]"
            >
              Crear folder
            </button>
          </div>
        ) : (
          <div className={view === "grid"
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
            : "flex flex-col gap-1"
          }>
            {folders.map((f) => (
              <Link
                key={f.id}
                href={`/folder/${f.id}`}
                className={view === "grid"
                  ? "flex flex-col rounded-xl border border-[#dadce0] bg-white hover:shadow-md transition-shadow overflow-hidden"
                  : "flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white transition-colors"
                }
              >
                {view === "grid" ? (
                  <>
                    {/* Thumbnail folder */}
                    <div className="h-28 bg-[#FFF8E1] flex items-end px-3 pb-1">
                      <svg viewBox="0 0 80 60" className="w-full" fill="none">
                        <rect x="0" y="12" width="80" height="48" rx="4" fill="#F9AB00" />
                        <rect x="0" y="8" width="36" height="12" rx="3" fill="#F9AB00" />
                      </svg>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium text-[#202124] truncate">{f.name || f.id}</p>
                      <p className="text-xs text-[#9aa0a6] font-mono truncate">drive-{userInfo.cronoCode}-{f.id}.com.blog</p>
                    </div>
                  </>
                ) : (
                  <>
                    <FolderOpen size={20} className="text-[#F9AB00] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#202124] truncate">{f.name || f.id}</p>
                      <p className="text-xs text-[#9aa0a6] font-mono truncate">drive-{userInfo.cronoCode}-{f.id}.com.blog</p>
                    </div>
                  </>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
