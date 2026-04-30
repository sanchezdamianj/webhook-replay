"use client";

import Link from "next/link";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-lg w-full rounded-3xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur p-6">
        <div className="text-xs font-medium opacity-70">Something went wrong</div>
        <div className="mt-2 text-lg font-semibold">We hit an unexpected error.</div>
        <div className="mt-3 text-sm opacity-80 whitespace-pre-wrap">{error.message}</div>
        <div className="mt-6 flex gap-2">
          <button
            className="rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium hover:opacity-90"
            onClick={reset}
          >
            Try again
          </button>
          <Link
            className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            href="/"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

