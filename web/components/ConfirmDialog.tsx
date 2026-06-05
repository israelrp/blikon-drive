"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }, []);

  // Escape cancela, Enter confirma
  useEffect(() => {
    if (!opts) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [opts, close]);

  const danger = opts?.danger ?? true;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"
          onClick={() => close(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${danger ? "bg-red-50" : "bg-[#e8f0fe]"}`}>
                <AlertTriangle size={20} className={danger ? "text-red-500" : "text-[#1a73e8]"} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-medium text-[#202124]">{opts.title ?? "¿Estás seguro?"}</h2>
                <p className="text-sm text-[#444746] mt-1">{opts.message}</p>
              </div>
              <button
                onClick={() => close(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#f6f8fc] shrink-0"
              >
                <X size={15} className="text-[#444746]" />
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => close(false)}
                className="px-4 py-2 text-sm font-medium text-[#444746] hover:bg-[#f6f8fc] rounded-full transition-colors"
              >
                {opts.cancelLabel ?? "Cancelar"}
              </button>
              <button
                autoFocus
                onClick={() => close(true)}
                className={`px-4 py-2 text-sm font-medium text-white rounded-full transition-colors ${
                  danger ? "bg-red-500 hover:bg-red-600" : "bg-[#1a73e8] hover:bg-[#1557b0]"
                }`}
              >
                {opts.confirmLabel ?? "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
