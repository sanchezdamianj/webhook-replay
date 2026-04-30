"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

export default function MarketingLanding() {
  const router = useRouter();

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const bullets = useMemo(
    () => [
      {
        title: "Ingest",
        body: "Capture every webhook with headers + raw body, tied to a destination.",
      },
      {
        title: "Inspect",
        body: "See the exact request, delivery attempts, and replay outcomes.",
      },
      {
        title: "Replay",
        body: "Retry deliveries safely and audit what happened—fast.",
      },
    ],
    []
  );

  const useCases = useMemo(
    () => [
      { title: "Stripe / Payments", body: "Re-run failed `invoice.paid` safely during incidents." },
      { title: "E-commerce", body: "Replay stock/order webhooks into a staging environment." },
      { title: "Internal systems", body: "Audit deliveries and debug signature/header mismatches." },
      { title: "Partners", body: "Prove what you sent and when. Reduce support ping-pong." },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(900px_circle_at_10%_10%,rgba(96,165,250,0.16),transparent_40%),radial-gradient(900px_circle_at_90%_30%,rgba(244,114,182,0.12),transparent_45%),radial-gradient(900px_circle_at_40%_90%,rgba(34,211,238,0.10),transparent_45%)]">
      <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/10 bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-3">
          <button
            className="flex items-center gap-2 text-sm font-semibold tracking-tight hover:opacity-90"
            onClick={() => scrollTo("top")}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-black/10 dark:border-white/10 bg-white/20 dark:bg-black/20">
              WR
            </span>
            Webhook Replay
          </button>

          <nav className="hidden sm:flex items-center gap-4 text-sm opacity-80">
            <button className="hover:opacity-100" onClick={() => scrollTo("how-it-works")}>
              How it works
            </button>
            <button className="hover:opacity-100" onClick={() => scrollTo("demo")}>
              Demo
            </button>
            <button className="hover:opacity-100" onClick={() => scrollTo("use-cases")}>
              Use cases
            </button>
            <a className="hover:opacity-100" href="http://localhost:3000/v1/status" target="_blank" rel="noreferrer">
              API
            </a>
            <a className="hover:opacity-100" href="http://localhost:3001/health" target="_blank" rel="noreferrer">
              Gateway
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => router.push("/login")}
            >
              Log in
            </button>
            <button
              className="hidden sm:inline-flex rounded-lg bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm font-medium hover:opacity-90"
              onClick={() => router.push("/login")}
            >
              Start free
            </button>
          </div>
        </div>
      </header>

      <div id="top" className="mx-auto max-w-6xl px-6 py-10 scroll-mt-24">
        <div className="rounded-3xl border border-black/10 dark:border-white/10 overflow-hidden bg-white/40 dark:bg-black/20 backdrop-blur">
          <div className="relative p-8 sm:p-10">
            <div className="flex flex-col lg:flex-row gap-10 items-start">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs opacity-80">
                  Dev MVP
                  <span className="opacity-60">•</span>
                  Webhooks you can trust
                </div>
                <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight">
                  Monitor and replay webhooks.
                  <span className="block opacity-80">Without guessing.</span>
                </h1>
                <p className="mt-4 text-base opacity-80 max-w-xl leading-relaxed">
                  Webhook Replay gives you a clean place to ingest events, inspect the exact request,
                  and replay deliveries with attempts tracking.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    className="rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium hover:opacity-90"
                    onClick={() => router.push("/login")}
                  >
                    Open dashboard
                  </button>
                  <button
                    className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                    onClick={() => scrollTo("how-it-works")}
                  >
                    How it works
                  </button>
                  <button
                    className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                    onClick={() => scrollTo("demo")}
                  >
                    Watch demo
                  </button>
                </div>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {bullets.map((b) => (
                    <div
                      key={b.title}
                      className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur p-4"
                    >
                      <div className="text-xs font-medium opacity-70">{b.title}</div>
                      <div className="mt-1 text-sm font-semibold">{b.body}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { k: "Live attempts", v: "Socket.IO" },
                    { k: "Fast ingest", v: "Gateway" },
                    { k: "Retry logic", v: "Backoff" },
                    { k: "Audit trail", v: "Attempts" },
                  ].map((m) => (
                    <div key={m.k} className="rounded-2xl border border-black/10 dark:border-white/10 p-3">
                      <div className="text-xs opacity-70">{m.k}</div>
                      <div className="text-sm font-semibold">{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div id="demo" className="w-full lg:w-[420px] scroll-mt-24">
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur p-4">
                  <div className="text-xs font-medium opacity-70">Demo</div>
                  <div className="mt-2 text-sm opacity-80">
                    A tiny walkthrough GIF you can ship in docs/landing.
                  </div>
                  <div className="mt-3 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                    <div className="flex items-center gap-1 px-3 py-2 border-b border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/20">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                      <div className="ml-2 text-[11px] opacity-70 font-mono">webhook-replay.local</div>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/demo.gif"
                      alt="Webhook Replay demo"
                      className="w-full h-auto"
                      loading="eager"
                    />
                  </div>
                  <div className="mt-3 text-xs opacity-70">
                    Tip: use <span className="font-mono">./scripts/smoke.sh</span> to generate data.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="how-it-works" className="mt-12 scroll-mt-24">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-medium opacity-70">How it works</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">Three steps, zero guesswork</div>
            </div>
            <button
              className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => router.push("/login")}
            >
              Try it
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-black/10 dark:border-white/10 p-5">
            <div className="text-xs font-medium opacity-70">1. Destination</div>
            <div className="mt-1 font-semibold">Create a target URL</div>
            <div className="mt-2 text-sm opacity-80">
              Point replays to a receiver: staging, local dev, or a controlled endpoint.
            </div>
          </div>
          <div className="rounded-2xl border border-black/10 dark:border-white/10 p-5">
            <div className="text-xs font-medium opacity-70">2. Ingest</div>
            <div className="mt-1 font-semibold">Send webhooks</div>
            <div className="mt-2 text-sm opacity-80">
              Post JSON to the ingest URL. You’ll see events and their metadata.
            </div>
          </div>
          <div className="rounded-2xl border border-black/10 dark:border-white/10 p-5">
            <div className="text-xs font-medium opacity-70">3. Replay</div>
            <div className="mt-1 font-semibold">Retry and audit</div>
            <div className="mt-2 text-sm opacity-80">
              Replay an event and watch delivery attempts update in realtime.
            </div>
          </div>
        </div>
        </div>

        <div id="use-cases" className="mt-12 scroll-mt-24">
          <div className="text-xs font-medium opacity-70">Use cases</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">Where it pays off fast</div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {useCases.map((u) => (
              <div key={u.title} className="rounded-2xl border border-black/10 dark:border-white/10 p-5">
                <div className="text-sm font-semibold">{u.title}</div>
                <div className="mt-2 text-sm opacity-80">{u.body}</div>
              </div>
            ))}
          </div>
        </div>

        <footer className="mt-14 border-t border-black/10 dark:border-white/10 pt-8 pb-10">
          <div className="flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">Webhook Replay</div>
              <div className="mt-1 text-xs opacity-70">
                Ingest • Inspect • Replay — dev MVP.
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm opacity-80">
              <button className="hover:opacity-100" onClick={() => scrollTo("how-it-works")}>
                How it works
              </button>
              <button className="hover:opacity-100" onClick={() => scrollTo("demo")}>
                Demo
              </button>
              <button className="hover:opacity-100" onClick={() => scrollTo("use-cases")}>
                Use cases
              </button>
              <a className="hover:opacity-100" href="http://localhost:3000/v1/status" target="_blank" rel="noreferrer">
                API status
              </a>
              <a className="hover:opacity-100" href="http://localhost:3001/health" target="_blank" rel="noreferrer">
                Gateway health
              </a>
            </div>
          </div>
          <div className="mt-6 text-xs opacity-60">
            © {new Date().getFullYear()} Webhook Replay. Local dev build.
          </div>
        </footer>
      </div>
    </div>
  );
}

