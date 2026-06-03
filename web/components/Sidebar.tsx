"use client";

import { usePathname } from "next/navigation";
import { HardDrive } from "lucide-react";
import { UploadButton } from "./UploadButton";

export function Sidebar({
  coreFolderId,
  onUploaded,
}: {
  coreFolderId: string;
  onUploaded: () => void;
}) {
  const pathname = usePathname();
  const active = pathname.startsWith("/folder") || pathname === "/";

  return (
    <aside className="w-64 shrink-0 flex flex-col gap-2 py-3 pr-2">
      {/* New / Upload */}
      <div className="px-3 mb-1">
        <UploadButton coreFolderId={coreFolderId} onUploaded={onUploaded} />
      </div>

      {/* Nav — solo Mi Drive por ahora */}
      <nav className="flex flex-col gap-0.5">
        <div
          className={`flex items-center gap-3 px-4 py-2 rounded-r-full text-sm font-medium
            ${active ? "bg-[#c2e7ff] text-[#001d35]" : "text-[#444746]"}`}
        >
          <HardDrive size={18} />
          Mi Drive
        </div>
      </nav>

      {/* Storage bar */}
      <div className="mt-auto px-4 py-3">
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-[#1a73e8] rounded-full" style={{ width: "23%" }} />
        </div>
        <p className="text-xs text-[#444746]">2.3 GB de 15 GB usados</p>
      </div>
    </aside>
  );
}
