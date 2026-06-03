"use client";

import { useState } from "react";
import { DriveHeader } from "@/components/DriveHeader";

export function DriveHeaderSearchWrapper({
  q,
  folder,
}: {
  q?: string;
  folder?: string;
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  return <DriveHeader view={view} onViewChange={setView} coreFolderId={folder} />;
}
