"use client";

import { useEffect, useMemo, useState } from "react";

export type Command = {
  id: string;
  title: string;
  hint?: string;
  keywords?: string[];
  onRun: () => void | Promise<void>;
};

export default function CommandPalette({ commands }: { commands: Command[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const normalized = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalized) return commands;
    return commands.filter((c) => {
      const hay = `${c.title} ${c.hint ?? ""} ${(c.keywords ?? []).join(" ")}`.toLowerCase();
      return hay.includes(normalized);
    });
  }, [commands, normalized]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k";
      const isCmdK = (e.metaKey || e.ctrlKey) && isK;
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4" onMouseDown={() => setOpen(false)}>
      <div
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/70 text-white backdrop-blur shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <div className="text-xs opacity-70">Command</div>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a command…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <div className="text-[11px] opacity-60 font-mono">⌘K</div>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-4 text-sm opacity-70">No matches.</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                className="w-full text-left px-4 py-3 hover:bg-white/10 flex items-start justify-between gap-4"
                onClick={() => {
                  Promise.resolve(c.onRun()).finally(() => setOpen(false));
                }}
              >
                <div>
                  <div className="text-sm font-semibold">{c.title}</div>
                  {c.hint ? <div className="text-xs opacity-70 mt-0.5">{c.hint}</div> : null}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-white/10 text-xs opacity-70">
          Tip: ESC closes. Use search to find actions fast.
        </div>
      </div>
    </div>
  );
}

