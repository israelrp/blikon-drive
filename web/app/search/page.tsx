import { searchFiles } from "@/lib/api";
import { ArrowLeft, SearchX, Search } from "lucide-react";
import Link from "next/link";
import { DriveHeaderSearchWrapper } from "./DriveHeaderSearchWrapper";
import { SearchResultRow } from "./SearchResultRow";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; folder?: string }>;
}) {
  const { q, folder } = await searchParams;
  const results = q ? await searchFiles(q, folder) : [];

  return (
    <div className="flex flex-col h-screen bg-[#f6f8fc]">
      <DriveHeaderSearchWrapper q={q} folder={folder} />

      <main className="flex-1 overflow-y-auto px-8 py-6 max-w-5xl mx-auto w-full">
        {/* Header de resultados */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={folder ? `/folder/${folder}` : "/"}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#e9eef6] transition-colors shrink-0"
          >
            <ArrowLeft size={18} className="text-[#444746]" />
          </Link>
          <div>
            <h2 className="text-base font-medium text-[#202124]">
              {q ? `Resultados para "${q}"` : "Busca archivos en Drive"}
            </h2>
            {q && results.length > 0 && (
              <p className="text-sm text-[#444746]">
                {results.length} {results.length === 1 ? "archivo encontrado" : "archivos encontrados"}
              </p>
            )}
          </div>
        </div>

        {/* Sin query */}
        {!q && (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-[#444746]">
            <Search size={56} strokeWidth={0.8} className="text-[#dadce0]" />
            <p className="text-sm">Escribe algo en la barra de búsqueda</p>
          </div>
        )}

        {/* Sin resultados */}
        {q && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-[#444746]">
            <SearchX size={56} strokeWidth={0.8} className="text-[#dadce0]" />
            <div className="text-center">
              <p className="font-medium text-[#202124]">Sin resultados para "{q}"</p>
              <p className="text-sm mt-1">Prueba con el nombre del archivo, extensión o tipo</p>
            </div>
          </div>
        )}

        {/* Resultados en lista */}
        {results.length > 0 && (
          <div className="bg-white rounded-xl border border-[#dadce0] overflow-hidden">
            {/* Cabecera */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[#dadce0] text-xs font-medium text-[#444746] uppercase tracking-wide">
              <div className="w-8" />
              <p className="flex-1">Nombre</p>
              <p className="w-36 hidden md:block">Ubicación</p>
              <p className="w-20 hidden sm:block">Tipo</p>
              <p className="w-24 text-right">Tamaño</p>
            </div>

            {results.map((f) => (
              <SearchResultRow key={f.id} file={f} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
