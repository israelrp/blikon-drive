import {
  FileText, Image, Film, Music, Archive, Table2, Presentation, File,
} from "lucide-react";

const configs: Record<string, { bg: string; text: string; Icon: React.ElementType }> = {
  pdf:  { bg: "bg-red-100",    text: "text-red-600",    Icon: FileText },
  doc:  { bg: "bg-blue-100",   text: "text-blue-600",   Icon: FileText },
  docx: { bg: "bg-blue-100",   text: "text-blue-600",   Icon: FileText },
  xls:  { bg: "bg-green-100",  text: "text-green-600",  Icon: Table2 },
  xlsx: { bg: "bg-green-100",  text: "text-green-600",  Icon: Table2 },
  csv:  { bg: "bg-green-100",  text: "text-green-600",  Icon: Table2 },
  ppt:  { bg: "bg-orange-100", text: "text-orange-600", Icon: Presentation },
  pptx: { bg: "bg-orange-100", text: "text-orange-600", Icon: Presentation },
  jpg:  { bg: "bg-purple-100", text: "text-purple-600", Icon: Image },
  jpeg: { bg: "bg-purple-100", text: "text-purple-600", Icon: Image },
  png:  { bg: "bg-purple-100", text: "text-purple-600", Icon: Image },
  gif:  { bg: "bg-purple-100", text: "text-purple-600", Icon: Image },
  webp: { bg: "bg-purple-100", text: "text-purple-600", Icon: Image },
  mp4:  { bg: "bg-indigo-100", text: "text-indigo-600", Icon: Film },
  mov:  { bg: "bg-indigo-100", text: "text-indigo-600", Icon: Film },
  avi:  { bg: "bg-indigo-100", text: "text-indigo-600", Icon: Film },
  mp3:  { bg: "bg-pink-100",   text: "text-pink-600",   Icon: Music },
  wav:  { bg: "bg-pink-100",   text: "text-pink-600",   Icon: Music },
  zip:  { bg: "bg-yellow-100", text: "text-yellow-700", Icon: Archive },
  rar:  { bg: "bg-yellow-100", text: "text-yellow-700", Icon: Archive },
};

const DEFAULT = { bg: "bg-gray-100", text: "text-gray-500", Icon: File };

export function FileTypeIcon({
  extension,
  size = "md",
}: {
  extension: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const cfg = (extension ? configs[extension.toLowerCase()] : null) ?? DEFAULT;
  const { bg, text, Icon } = cfg;

  const dims = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-16 h-16" : "w-10 h-10";
  const iconSize = size === "sm" ? 14 : size === "lg" ? 28 : 18;

  return (
    <div className={`${dims} ${bg} rounded-lg flex items-center justify-center shrink-0`}>
      <Icon size={iconSize} className={text} />
    </div>
  );
}
