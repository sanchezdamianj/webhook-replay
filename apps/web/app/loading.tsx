export default function Loading() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-4">
        <div className="h-10 w-56 rounded-xl bg-black/5 dark:bg-white/10 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="h-56 rounded-2xl bg-black/5 dark:bg-white/10 animate-pulse" />
            <div className="h-56 rounded-2xl bg-black/5 dark:bg-white/10 animate-pulse" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="h-72 rounded-2xl bg-black/5 dark:bg-white/10 animate-pulse" />
            <div className="h-72 rounded-2xl bg-black/5 dark:bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

