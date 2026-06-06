"use client";

import Link from "next/link";
import { useState } from "react";
import { Globe, Copy, Check, Lock } from "lucide-react";
import { folderSubdomainUrl } from "@/lib/utils";

interface Crumb { id: string; name: string; }

// Barra de dirección estilo navegador. Muestra la URL del subdominio
// (drive-{crono}-folder-folder.com.blog) pero cada segmento navega INTERNO
// (client-side, instantáneo) — no recarga la página.
export function AddressBar({
  cronoCode,
  breadcrumb,
  isShared = false,
  canWrite = true,
}: {
  cronoCode: string;
  breadcrumb: Crumb[];
  isShared?: boolean;
  canWrite?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const currentId = breadcrumb.length ? breadcrumb[breadcrumb.length - 1].id : "";
  const fullUrl   = folderSubdomainUrl(cronoCode, currentId);

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* sin permiso de clipboard */ }
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex items-center gap-2 flex-1 min-w-0 h-10 pl-3 pr-1.5 rounded-full bg-white border border-[#dadce0] shadow-sm hover:shadow transition-shadow">
        {isShared ? (
          <Lock size={14} className="text-[#137333] shrink-0" />
        ) : (
          <Globe size={15} className="text-[#1a73e8] shrink-0" />
        )}

        {/* Dirección — scroll horizontal si es muy larga */}
        <div className="flex-1 min-w-0 overflow-x-auto flex items-center text-sm font-mono whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-[#9aa0a6]">drive-</span>
          <Link href="/" className="text-[#1a73e8] hover:underline" title="Mi Drive">{cronoCode}</Link>
          {breadcrumb.map((c, i) => {
            const isCurrent = i === breadcrumb.length - 1;
            return (
              <span key={c.id} className="flex items-center">
                <span className="text-[#9aa0a6]">-</span>
                {isCurrent ? (
                  <span className="text-[#202124] font-semibold">{c.name}</span>
                ) : (
                  <Link href={`/folder/${c.id}`} className="text-[#444746] hover:text-[#1a73e8] hover:underline">{c.name}</Link>
                )}
              </span>
            );
          })}
          <span className="text-[#9aa0a6]">.com.blog</span>
        </div>

        {/* Copiar enlace */}
        <button
          onClick={copy}
          title="Copiar enlace"
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f6f8fc] transition-colors"
        >
          {copied
            ? <Check size={15} className="text-[#137333]" />
            : <Copy size={15} className="text-[#444746]" />}
        </button>
      </div>

      {isShared && (
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${canWrite ? "bg-[#e6f4ea] text-[#137333]" : "bg-[#fef7e0] text-[#b06000]"}`}>
          {canWrite ? "Editor" : "Solo lectura"}
        </span>
      )}
    </div>
  );
}
