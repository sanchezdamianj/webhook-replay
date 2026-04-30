"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Toast = {
  id: string;
  title: string;
  detail?: string;
  kind?: "info" | "success" | "error";
};

type ToastApi = {
  push: (t: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToasts() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within <ToastHost />");
  return ctx;
}

export default function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    const toast: Toast = { id, ...t };
    setToasts((prev) => [toast, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 2800);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setToasts([]);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed z-[70] right-4 bottom-4 space-y-2 w-[340px] max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => {
          const tone =
            t.kind === "success"
              ? "border-emerald-500/20 bg-emerald-500/10"
              : t.kind === "error"
                ? "border-red-500/25 bg-red-500/10"
                : "border-white/10 bg-black/60";
          return (
            <div
              key={t.id}
              className={`rounded-2xl border ${tone} backdrop-blur px-3 py-2 shadow-2xl`}
            >
              <div className="text-sm font-semibold text-white">{t.title}</div>
              {t.detail ? <div className="text-xs text-white/75 mt-0.5">{t.detail}</div> : null}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

