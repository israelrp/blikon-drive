"use client";

import { useState } from "react";
import Link from "next/link";
import { Folder, MoreVertical } from "lucide-react";
import { DriveFolder } from "@/lib/api";

export function FolderCard({ folder, view = "grid" }: { folder: DriveFolder; view?: "grid" | "list" }) {
  const [hovered, setHovered] = useState(false);

  const meta = [
    folder.childCount > 0 && `${folder.childCount} carpeta${folder.childCount > 1 ? "s" : ""}`,
    folder.fileCount  > 0 && `${folder.fileCount} archivo${folder.fileCount > 1 ? "s" : ""}`,
  ].filter(Boolean).join(" · ");

  if (view === "list") {
    return (
      <div
        className={`relative transition-colors ${hovered ? "bg-[#f6f8fc]" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Link href={`/folder/${folder.id}`}>
          <div className="flex items-center gap-3 px-4 py-2 cursor-pointer">
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <Folder size={20} className="text-[#F9AB00]" fill="#FFF0C2" />
            </div>
            <p className="flex-1 text-sm text-[#202124] font-medium truncate min-w-0">{folder.name}</p>
            <p className="w-40 text-sm text-[#444746] hidden md:block">Carpeta</p>
            <p className="w-32 text-sm text-[#444746] hidden lg:block">—</p>
            <p className="w-24 text-sm text-[#444746] text-right shrink-0">—</p>
            <div className="w-8 shrink-0" />
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={`/folder/${folder.id}`}>
        <div className={`border rounded-xl overflow-hidden cursor-pointer transition-all
          ${hovered
            ? "border-[#dadce0] bg-white shadow-md"
            : "border-[#dadce0] bg-white"}`}
        >
          {/* Área de preview — fondo ámbar suave con ícono grande */}
          <div className="h-36 flex items-center justify-center bg-[#FFF8E1] border-b border-[#F5E6B2] relative">
            {/* Folder shape — tab + cuerpo */}
            <div className="flex flex-col items-start gap-0 w-20">
              {/* Tab del folder */}
              <div className="h-3 w-10 bg-[#F9AB00] rounded-t-md ml-2" />
              {/* Cuerpo del folder */}
              <div className="w-20 h-14 bg-[#F9AB00] rounded-b-xl rounded-tr-xl flex items-center justify-center">
                <div className="w-10 h-1.5 bg-[#E8951A] rounded-full opacity-60" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-3 py-2.5">
            <Folder size={16} className="text-[#F9AB00] shrink-0" fill="#FFF0C2" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[#202124] truncate font-medium">{folder.name}</p>
              {meta && <p className="text-xs text-[#444746] truncate">{meta}</p>}
            </div>
          </div>
        </div>
      </Link>

      {/* Menú ⋮ */}
      {hovered && (
        <div className="absolute top-2 right-2">
          <button className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm shadow flex items-center justify-center hover:bg-white transition-colors">
            <MoreVertical size={16} className="text-[#444746]" />
          </button>
        </div>
      )}
    </div>
  );
}
