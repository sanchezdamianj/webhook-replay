"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";

type AuthOk = {
  ok: true;
  user: { id: number; email: string; ui_flags?: Record<string, unknown> };
  account?: { id: number; name: string };
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("password");
  const [accountName, setAccountName] = useState("Acme");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (mode === "login" ? "Log in" : "Create account"),
    [mode]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, account_name: accountName };
      await apiFetch<AuthOk>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(900px_circle_at_10%_10%,rgba(96,165,250,0.16),transparent_40%),radial-gradient(900px_circle_at_90%_30%,rgba(244,114,182,0.12),transparent_45%),radial-gradient(900px_circle_at_40%_90%,rgba(34,211,238,0.10),transparent_45%)]">
      <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/10 bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-3">
          <button
            className="flex items-center gap-2 text-sm font-semibold tracking-tight hover:opacity-90"
            onClick={() => router.push("/")}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-black/10 dark:border-white/10 bg-white/20 dark:bg-black/20">
              WR
            </span>
            Webhook Replay
          </button>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => router.push("/")}
            >
              Home
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs opacity-80">
              Dev MVP
              <span className="opacity-60">•</span>
              Secure tokens
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              {mode === "login" ? "Welcome back." : "Create your account."}
            </h1>
            <p className="mt-3 text-sm opacity-80 leading-relaxed max-w-prose">
              Ingest webhooks, inspect exact payloads, and replay deliveries with attempts tracking.
            </p>

            <div className="mt-6 flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={
                  mode === "login"
                    ? "rounded-lg bg-black text-white dark:bg-white dark:text-black px-3 py-1.5"
                    : "rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                }
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={
                  mode === "signup"
                    ? "rounded-lg bg-black text-white dark:bg-white dark:text-black px-3 py-1.5"
                    : "rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                }
              >
                Sign up
              </button>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4">
                <div className="text-xs opacity-70">Realtime</div>
                <div className="mt-1 font-semibold">Attempts updates</div>
              </div>
              <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4">
                <div className="text-xs opacity-70">Replay</div>
                <div className="mt-1 font-semibold">Retry deliveries</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur p-8">
            <div className="text-xs font-medium opacity-70">{title}</div>
            <div className="mt-1 text-sm opacity-80">
              {mode === "login" ? "Use your existing account." : "Create an account in seconds."}
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {mode === "signup" ? (
                <label className="block">
                  <div className="mb-1 text-sm opacity-80">Account name</div>
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400/40"
                    placeholder="Acme"
                  />
                </label>
              ) : null}

              <label className="block">
                <div className="mb-1 text-sm opacity-80">Email</div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400/40"
                  placeholder="you@company.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm opacity-80">Password</div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400/40"
                  placeholder="••••••••"
                />
              </label>

              {error ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200 dark:text-red-100">
                  {error}
                </div>
              ) : null}

              <button
                disabled={busy}
                className="w-full rounded-xl bg-black text-white dark:bg-white dark:text-black px-3 py-2 font-medium hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Working…" : mode === "login" ? "Log in" : "Create account"}
              </button>
            </form>

            <div className="mt-4 text-xs opacity-70">
              Dev MVP: tokens are stored in localStorage.
            </div>
          </div>
        </div>

        <footer className="mt-14 border-t border-black/10 dark:border-white/10 pt-8 pb-10">
          <div className="flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">Webhook Replay</div>
              <div className="mt-1 text-xs opacity-70">Local dev build.</div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm opacity-80">
              <a className="hover:opacity-100" href="http://localhost:3000/v1/status" target="_blank" rel="noreferrer">
                API status
              </a>
              <a className="hover:opacity-100" href="http://localhost:3001/health" target="_blank" rel="noreferrer">
                Gateway health
              </a>
            </div>
          </div>
          <div className="mt-6 text-xs opacity-60">© {new Date().getFullYear()} Webhook Replay.</div>
        </footer>
      </div>
    </div>
  );
}

