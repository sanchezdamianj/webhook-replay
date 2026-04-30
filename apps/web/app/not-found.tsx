import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-lg w-full rounded-3xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur p-6">
        <div className="text-xs font-medium opacity-70">404</div>
        <div className="mt-2 text-lg font-semibold">Page not found.</div>
        <div className="mt-3 text-sm opacity-80">
          The page you’re looking for doesn’t exist.
        </div>
        <div className="mt-6">
          <Link
            className="inline-flex rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium hover:opacity-90"
            href="/"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

