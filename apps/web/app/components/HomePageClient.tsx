"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiMe, apiUpdateUiFlags } from "../lib/api";
import { subscribeToDeliveryAttempts } from "../lib/realtime";
import type {
  DeliveryAttempt,
  Destination,
  EventDetail,
  EventRow,
  LogExportCreateResponse,
  LogExportStatus,
} from "../lib/types";
import MarketingLanding from "./MarketingLanding";
import { useToasts } from "./ToastHost";
import CommandPalette from "./CommandPalette";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const dtf = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type EventsIndexResponse = {
  page: number;
  page_size: number;
  events: EventRow[];
};

export default function HomePageClient() {
  return <AuthedHome />;
}

function AuthedHome() {
  const router = useRouter();
  const [uiFlags, setUiFlags] = useState<Record<string, unknown> | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    apiMe()
      .then((me) => {
        setAuthed(true);
        setUiFlags(me.user.ui_flags ?? {});
        const flags = me.user.ui_flags ?? {};
        const seen = Boolean(flags["onboarding_seen_v1"]);
        if (!seen) setOnboardingOpen(true);
      })
      .catch((e) => {
        const msg = String(e?.message ?? e);
        if (msg.includes("unauthorized") || msg.includes("401")) {
          setAuthed(false);
          return;
        }
        // Unknown errors still show the landing with a generic prompt.
        setAuthed(false);
      });
  }, []);

  if (authed === false) return <MarketingLanding />;
  if (authed == null) return <div className="min-h-screen" />;

  return (
    <Dashboard
      router={router}
      uiFlags={uiFlags}
      setUiFlags={setUiFlags}
      onboardingOpen={onboardingOpen}
      setOnboardingOpen={setOnboardingOpen}
      tourOpen={tourOpen}
      setTourOpen={setTourOpen}
    />
  );
}

function Dashboard({
  router,
  uiFlags,
  setUiFlags,
  onboardingOpen,
  setOnboardingOpen,
  tourOpen,
  setTourOpen,
}: {
  router: ReturnType<typeof useRouter>;
  uiFlags: Record<string, unknown> | null;
  setUiFlags: (v: Record<string, unknown> | null) => void;
  onboardingOpen: boolean;
  setOnboardingOpen: (v: boolean) => void;
  tourOpen: boolean;
  setTourOpen: (v: boolean) => void;
}) {
  const toasts = useToasts();
  const [selectedDestinationId, setSelectedDestinationId] = useState<number | null>(null);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPageSize, setEventsPageSize] = useState(50);
  const [eventsTotalOnPage, setEventsTotalOnPage] = useState(0);
  const [eventIdQuery, setEventIdQuery] = useState("");
  const [eventsFilter, setEventsFilter] = useState<"all" | "ok" | "failed" | "pending" | "never">(
    "all"
  );
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [bulkReplaying, setBulkReplaying] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [exportScope, setExportScope] = useState<"current" | "all">("current");
  const [exportFromLocal, setExportFromLocal] = useState("");
  const [exportToLocal, setExportToLocal] = useState("");
  const [logExportId, setLogExportId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  const qc = useQueryClient();

  const destinationsQ = useQuery({
    queryKey: ["destinations"],
    queryFn: async () => await apiFetch<Destination[]>("/v1/destinations"),
  });

  const destinations = useMemo(() => destinationsQ.data ?? [], [destinationsQ.data]);

  const eventsQ = useQuery({
    queryKey: ["events", selectedDestinationId, eventsPage],
    enabled: selectedDestinationId != null,
    queryFn: async () => {
      const qs = new URLSearchParams({
        destination_id: String(selectedDestinationId),
        page: String(eventsPage),
      });
      return await apiFetch<EventsIndexResponse>(`/v1/events?${qs.toString()}`);
    },
  });

  const events = eventsQ.data?.events ?? [];

  const selectedEventQ = useQuery({
    queryKey: ["event", selectedEventId],
    enabled: selectedEventId != null,
    queryFn: async () => await apiFetch<EventDetail>(`/v1/events/${selectedEventId}`),
  });

  const selectedEvent = selectedEventQ.data ?? null;

  const attemptsQ = useQuery({
    queryKey: ["attempts", selectedEventId],
    enabled: selectedEventId != null,
    queryFn: async () =>
      await apiFetch<{ attempts: DeliveryAttempt[] }>(`/v1/delivery_attempts?event_id=${selectedEventId}`),
  });

  const attempts = attemptsQ.data?.attempts ?? [];

  const logExportQ = useQuery<LogExportStatus>({
    queryKey: ["log-export", logExportId],
    enabled: logExportId != null,
    queryFn: async () => await apiFetch<LogExportStatus>(`/v1/exports/logs/${logExportId}`),
    refetchInterval: (query) => (isLogExportTerminal(query.state.data?.status) ? false : 2000),
  });

  const selectedDestination = useMemo(
    () => destinations.find((d) => d.id === selectedDestinationId) ?? null,
    [destinations, selectedDestinationId]
  );

  const refreshDestinations = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ["destinations"] });
  };

  async function ensureSeedDestination() {
    const existing = destinations[0];
    if (existing) return existing;
    const created = await apiFetch<Destination>("/v1/destinations", {
      method: "POST",
      body: JSON.stringify({
        destination: { name: "Local receiver", target_url: "http://receiver:4000/echo" },
      }),
    });
    await refreshDestinations();
    return created;
  }

  async function seedOneWebhook(publicKey: string) {
    await fetch(`http://localhost:3001/webhook/${publicKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demo: true, ts: new Date().toISOString() }),
    });
  }

  async function refreshEvents(destinationId: number, page: number) {
    setError(null);
    await qc.invalidateQueries({ queryKey: ["events", destinationId, page] });
  }

  async function loadEvent(id: number) {
    setError(null);
    await qc.invalidateQueries({ queryKey: ["event", id] });
  }

  async function loadAttempts(eventId: number) {
    setError(null);
    await qc.invalidateQueries({ queryKey: ["attempts", eventId] });
  }

  const createDestinationM = useMutation({
    mutationFn: async ({ name, target_url }: { name: string; target_url: string }) =>
      await apiFetch<Destination>("/v1/destinations", {
        method: "POST",
        body: JSON.stringify({ destination: { name, target_url } }),
      }),
    onSuccess: async () => {
      await refreshDestinations();
      toasts.push({ kind: "success", title: "Destination created" });
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  async function createDestination(name: string, target_url: string) {
    setLoading("Creating destination...");
    setError(null);
    try {
      await createDestinationM.mutateAsync({ name, target_url });
    } finally {
      setLoading(null);
    }
  }

  const updateDestinationM = useMutation({
    mutationFn: async ({
      destinationId,
      name,
      target_url,
    }: {
      destinationId: number;
      name: string;
      target_url: string;
    }) =>
      await apiFetch<Destination>(`/v1/destinations/${destinationId}`, {
        method: "PATCH",
        body: JSON.stringify({ destination: { name, target_url } }),
      }),
    onSuccess: async () => {
      await refreshDestinations();
      toasts.push({ kind: "success", title: "Destination updated" });
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  async function updateDestination(destinationId: number, name: string, target_url: string) {
    setLoading("Updating destination...");
    setError(null);
    try {
      await updateDestinationM.mutateAsync({ destinationId, name, target_url });
    } finally {
      setLoading(null);
    }
  }

  const deleteDestinationM = useMutation({
    mutationFn: async (destinationId: number) =>
      await apiFetch<void>(`/v1/destinations/${destinationId}`, { method: "DELETE" }),
    onSuccess: async (_data, destinationId) => {
      await refreshDestinations();
      if (selectedDestinationId === destinationId) setSelectedDestinationId(null);
      toasts.push({ kind: "success", title: "Destination deleted" });
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  async function deleteDestination(destinationId: number) {
    setLoading("Deleting destination...");
    setError(null);
    try {
      await deleteDestinationM.mutateAsync(destinationId);
    } finally {
      setLoading(null);
    }
  }

  async function replayEvent(eventId: number) {
    setLoading("Replaying...");
    setError(null);
    try {
      await apiFetch<{ accepted: boolean; attempt_id: number }>(`/v1/events/${eventId}/replay`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadEvent(eventId);
      await loadAttempts(eventId);
      toasts.push({ kind: "success", title: "Replay queued", detail: `Event ${eventId}` });
    } finally {
      setLoading(null);
    }
  }

  const createLogExportM = useMutation({
    mutationFn: async ({
      destinationId,
      receivedAtFrom,
      receivedAtTo,
    }: {
      destinationId: number | null;
      receivedAtFrom: string | null;
      receivedAtTo: string | null;
    }) =>
      await apiFetch<LogExportCreateResponse>("/v1/exports/logs", {
        method: "POST",
        body: JSON.stringify({
          destination_id: destinationId,
          received_at_from: receivedAtFrom,
          received_at_to: receivedAtTo,
        }),
      }),
    onSuccess: (data) => {
      setLogExportId(data.export_id);
      toasts.push({ kind: "success", title: "Export queued", detail: `Job ${data.export_id}` });
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  async function createLogExport() {
    const destinationId = exportScope === "current" ? selectedDestinationId : null;
    if (exportScope === "current" && destinationId == null) {
      setError("Select a destination before exporting current destination logs.");
      return;
    }

    const receivedAtFrom = datetimeLocalToIso(exportFromLocal);
    const receivedAtTo = datetimeLocalToIso(exportToLocal);
    if (receivedAtFrom && receivedAtTo && Date.parse(receivedAtFrom) > Date.parse(receivedAtTo)) {
      setError("The export start date must be before the end date.");
      return;
    }

    setLoading("Queueing log export...");
    setError(null);
    try {
      await createLogExportM.mutateAsync({ destinationId, receivedAtFrom, receivedAtTo });
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    if (destinations.length > 0 && selectedDestinationId == null) {
      setSelectedDestinationId(destinations[0]!.id);
    }
  }, [destinations, selectedDestinationId]);


  useEffect(() => {
    if (eventsQ.data) {
      setEventsTotalOnPage(eventsQ.data.events.length);
      setEventsPageSize(eventsQ.data.page_size);
    }
  }, [eventsQ.data]);

  useEffect(() => {
    if (!autoRefresh) return;
    if (selectedDestinationId == null) return;

    const id = setInterval(() => {
      refreshEvents(selectedDestinationId, eventsPage).catch((e) =>
        setError(String(e?.message ?? e))
      );
    }, 3000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, selectedDestinationId, eventsPage, eventsPageSize]);

  useEffect(() => {
    if (selectedEventId == null) {
      setSelectedAttemptId(null);
      setEventDetailOpen(false);
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
      return;
    }
    loadEvent(selectedEventId).catch((e) => setError(String(e?.message ?? e)));
    loadAttempts(selectedEventId).catch((e) => setError(String(e?.message ?? e)));

    subscriptionRef.current?.unsubscribe();

    const realtimeBase =
      typeof process.env.NEXT_PUBLIC_API_BASE_URL === "string"
        ? process.env.NEXT_PUBLIC_API_BASE_URL
        : "";
    if (!realtimeBase) {
      return;
    }

    const unsubscribe = subscribeToDeliveryAttempts(realtimeBase, selectedEventId, (data: unknown) => {
      const payload = data as { type?: string; attempt?: DeliveryAttempt };
      if (payload?.type !== "delivery_attempt" || !payload.attempt) return;

      qc.setQueryData<{ attempts: DeliveryAttempt[] }>(["attempts", selectedEventId], (prev) => {
        const list = prev?.attempts ?? [];
        const idx = list.findIndex((a) => a.id === payload.attempt!.id);
        if (idx === -1) return { attempts: [payload.attempt!, ...list] };
        const next = list.slice();
        next[idx] = payload.attempt!;
        return { attempts: next };
      });
    });

    subscriptionRef.current = { unsubscribe };

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  return (
    <div className="min-h-screen">
      <CommandPalette
        commands={[
          {
            id: "help",
            title: "Open Help / Onboarding",
            hint: "Show onboarding and actions",
            onRun: () => setOnboardingOpen(true),
          },
          {
            id: "tour",
            title: "Start product tour",
            hint: "Coachmarks spotlight",
            onRun: () => setTourOpen(true),
          },
          {
            id: "refresh",
            title: "Refresh events",
            hint: "Reload current destination events",
            onRun: () => {
              if (selectedDestinationId == null) return;
              return refreshEvents(selectedDestinationId, eventsPage);
            },
          },
          {
            id: "seed",
            title: "Generate sample webhook",
            hint: "Creates local destination if needed",
            onRun: async () => {
              const dest = await ensureSeedDestination();
              setSelectedDestinationId(dest.id);
              await seedOneWebhook(dest.public_key);
              await refreshEvents(dest.id, 1);
              toasts.push({ kind: "success", title: "Demo data created" });
            },
          },
        ]}
      />
      <header className="border-b border-black/10 dark:border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Webhook Replay</div>
            <div className="text-xs opacity-70">Dev MVP — ingest, monitor, replay</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => setOnboardingOpen(true)}
              data-tour="help"
            >
              Help
            </button>
            <button
              className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => {
                fetch("/api/auth/logout", { method: "POST" })
                  .catch(() => {})
                  .finally(() => router.replace("/login"));
              }}
            >
              Log out
            </button>
            <a
              className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
              href="http://localhost:3000/v1/status"
              target="_blank"
              rel="noreferrer"
            >
              API status
            </a>
            <a
              className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
              href="http://localhost:3001/health"
              target="_blank"
              rel="noreferrer"
            >
              Gateway health
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
            <div className="font-semibold mb-2">Destinations</div>
            <div className="space-y-2">
              <select
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                value={selectedDestinationId ?? ""}
                onChange={(e) => setSelectedDestinationId(Number(e.target.value))}
                data-tour="destination-select"
              >
                <option value="" disabled>
                  {destinations.length === 0 ? "No destinations yet" : "Select destination"}
                </option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              {selectedDestination ? (
                <div className="text-xs opacity-75">
                  <div className="truncate">
                    <span className="font-medium">public_key:</span> {selectedDestination.public_key}
                  </div>
                  <div className="truncate">
                    <span className="font-medium">target_url:</span> {selectedDestination.target_url}
                  </div>
                  <div className="mt-2">
                    <div className="font-medium mb-1">Ingest URL</div>
                    <div className="flex gap-2 items-start">
                      <code className="flex-1 block rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 text-[11px] break-all">
                        {`http://localhost:3001/webhook/${selectedDestination.public_key}`}
                      </code>
                      <button
                        className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
                        onClick={() => {
                          const url = `http://localhost:3001/webhook/${selectedDestination.public_key}`;
                          navigator.clipboard?.writeText(url).catch(() => {});
                          toasts.push({ kind: "success", title: "Copied ingest URL" });
                        }}
                        data-tour="ingest-copy"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <DestinationEditor
                    destination={selectedDestination}
                    disabled={loading != null}
                    onUpdate={(name, targetUrl) =>
                      updateDestination(selectedDestination.id, name, targetUrl).catch((e) =>
                        setError(String(e?.message ?? e))
                      )
                    }
                    onDelete={() =>
                      deleteDestination(selectedDestination.id).catch((e) =>
                        setError(String(e?.message ?? e))
                      )
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>

          <CreateDestinationCard onCreate={createDestination} loading={loading != null} />

          <LogExportCard
            scope={exportScope}
            onScopeChange={setExportScope}
            fromLocal={exportFromLocal}
            onFromLocalChange={setExportFromLocal}
            toLocal={exportToLocal}
            onToLocalChange={setExportToLocal}
            selectedDestination={selectedDestination}
            exportStatus={logExportQ.data ?? null}
            isStatusLoading={logExportQ.isFetching}
            isCreating={createLogExportM.isPending}
            onCreate={() => createLogExport().catch((e) => setError(String(e?.message ?? e)))}
          />
        </section>

        <section className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">Events</div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs opacity-80 select-none">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  Auto-refresh
                </label>
                <button
                  className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                  onClick={() => {
                    if (selectedDestinationId == null) return;
                    refreshEvents(selectedDestinationId, eventsPage).catch((e) =>
                      setError(String(e?.message ?? e))
                    );
                  }}
                  disabled={selectedDestinationId == null}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="text-xs opacity-70">Page</div>
                <button
                  className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                  disabled={eventsPage <= 1}
                  onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <div className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-2 py-1">
                  {eventsPage}
                </div>
                <button
                  className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                  disabled={eventsTotalOnPage < eventsPageSize}
                  onClick={() => setEventsPage((p) => p + 1)}
                >
                  Next
                </button>

                <div className="ml-2 text-xs opacity-70">Page size</div>
                <select
                  className="text-xs rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                  value={eventsPageSize}
                  disabled
                >
                  <option value={eventsPageSize}>{eventsPageSize}</option>
                </select>
              </div>

              <div className="flex flex-col md:flex-row gap-2 md:items-center">
                <div className="flex items-center gap-2">
                  <div className="text-xs opacity-70">Filter</div>
                  <select
                    className="text-xs rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                    value={eventsFilter}
                    onChange={(e) => setEventsFilter(e.target.value as typeof eventsFilter)}
                  >
                    <option value="all">All</option>
                    <option value="ok">OK</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                    <option value="never">Never replayed</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-xs opacity-70">Go to ID</div>
                  <input
                    className="w-28 text-xs rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                    inputMode="numeric"
                    placeholder="e.g. 123"
                    value={eventIdQuery}
                    onChange={(e) => setEventIdQuery(e.target.value)}
                  />
                  <button
                    className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                    disabled={eventIdQuery.trim() === ""}
                    onClick={() => {
                      const id = Number(eventIdQuery.trim());
                      if (!Number.isFinite(id) || id <= 0) return;
                      setSelectedEventId(id);
                    }}
                  >
                    Open
                  </button>
                </div>

                <button
                  className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                  disabled={
                    selectedDestinationId == null ||
                    bulkReplaying ||
                    filteredEvents(events, "failed").length === 0
                  }
                  onClick={() => {
                    if (selectedDestinationId == null) return;
                    const failed = filteredEvents(events, "failed");
                    if (failed.length === 0) return;

                    setBulkReplaying(true);
                    setLoading(`Replaying ${failed.length} failed events...`);
                    setError(null);

                    Promise.allSettled(
                      failed.map((e) =>
                        apiFetch<{ accepted: boolean; attempt_id: number }>(`/v1/events/${e.id}/replay`, {
                          method: "POST",
                          body: JSON.stringify({}),
                        })
                      )
                    )
                      .then(() => refreshEvents(selectedDestinationId, eventsPage))
                      .catch((e) => setError(String(e?.message ?? e)))
                      .finally(() => {
                        setBulkReplaying(false);
                        setLoading(null);
                      });
                  }}
                >
                  Replay failed (page)
                </button>
              </div>
            </div>

            {filteredEvents(events, eventsFilter).length === 0 ? (
              <div className="text-sm opacity-70 mt-3">No events yet. Send a webhook to the ingest URL.</div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm" data-tour="events-table">
                  <thead className="text-xs opacity-70">
                    <tr className="text-left border-b border-black/10 dark:border-white/10">
                      <th className="py-2 pr-2">ID</th>
                      <th className="py-2 pr-2">Received</th>
                      <th className="py-2 pr-2">Method</th>
                      <th className="py-2 pr-2">Content-Type</th>
                      <th className="py-2 pr-2">Last replay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents(events, eventsFilter).map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                        onClick={() => {
                          setSelectedEventId(e.id);
                          setEventDetailOpen(true);
                        }}
                      >
                        <td className="py-2 pr-2">{e.id}</td>
                        <td className="py-2 pr-2">{formatIso(e.received_at) ?? "-"}</td>
                        <td className="py-2 pr-2 font-mono">{e.http_method}</td>
                        <td className="py-2 pr-2">{e.content_type ?? "-"}</td>
                        <td className="py-2 pr-2">
                          <EventAttemptBadge attempt={e.latest_attempt} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">Event detail</div>
              <div className="flex items-center gap-2">
                <button
                  className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                  onClick={() => setEventDetailOpen(true)}
                  disabled={selectedEventId == null}
                  data-tour="event-open"
                >
                  Open
                </button>
                <button
                  className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                  onClick={() => {
                    if (selectedEventId == null) return;
                    replayEvent(selectedEventId).catch((e) => setError(String(e?.message ?? e)));
                  }}
                  disabled={selectedEventId == null || loading != null}
                  data-tour="event-replay"
                >
                  Replay
                </button>
              </div>
            </div>

            <div className="text-sm opacity-70 mt-3">
              {selectedEventId == null ? "Select an event to inspect." : "Click Open to view details."}
            </div>
          </div>

          {eventDetailOpen ? (
            <Modal onClose={() => setEventDetailOpen(false)}>
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/0 dark:bg-black/0 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">Event detail</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                      onClick={() => {
                        if (selectedEventId == null) return;
                        replayEvent(selectedEventId).catch((e) => setError(String(e?.message ?? e)));
                      }}
                      disabled={selectedEventId == null || loading != null}
                    >
                      Replay
                    </button>
                    <button
                      className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                      onClick={() => setEventDetailOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>

                {selectedEvent == null ? (
                  <div className="text-sm opacity-70 mt-3">
                    {selectedEventId == null ? "Select an event to inspect." : "Loading..."}
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <Info label="id" value={String(selectedEvent.id)} />
                      <Info label="received_at" value={formatIso(selectedEvent.received_at) ?? "-"} />
                      <Info label="http_method" value={selectedEvent.http_method} mono />
                      <Info label="content_type" value={selectedEvent.content_type ?? "-"} />
                      <Info label="source_ip" value={selectedEvent.source_ip ?? "-"} />
                      <Info label="request_path" value={selectedEvent.request_path ?? "-"} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs font-medium mb-1">
                        <div>Headers</div>
                        <button
                          className="text-[11px] rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
                          onClick={() => {
                            const txt = JSON.stringify(selectedEvent.headers, null, 2);
                            navigator.clipboard?.writeText(txt).catch(() => {});
                        toasts.push({ kind: "success", title: "Copied headers" });
                          }}
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-[11px] rounded-lg border border-black/10 dark:border-white/10 p-3 overflow-auto max-h-64">
                        {JSON.stringify(selectedEvent.headers, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs font-medium mb-1">
                        <div>Body</div>
                        <div className="flex items-center gap-2">
                          <button
                            className="text-[11px] rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
                            onClick={() => {
                              navigator.clipboard?.writeText(selectedEvent.raw_body ?? "").catch(() => {});
                          toasts.push({ kind: "success", title: "Copied body (raw)" });
                            }}
                          >
                            Copy raw
                          </button>
                          <button
                            className="text-[11px] rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
                            onClick={() => {
                              const pretty = prettyBody(selectedEvent.raw_body);
                              navigator.clipboard?.writeText(pretty).catch(() => {});
                          toasts.push({ kind: "success", title: "Copied body (pretty)" });
                            }}
                          >
                            Copy pretty
                          </button>
                        </div>
                      </div>
                      <pre className="text-[11px] rounded-lg border border-black/10 dark:border-white/10 p-3 overflow-auto max-h-64">
                        {prettyBody(selectedEvent.raw_body)}
                      </pre>
                    </div>

                    <div>
                      <div className="text-xs font-medium mb-1">Attempts</div>
                      {attempts.length === 0 ? (
                        <div className="text-sm opacity-70">No attempts yet.</div>
                      ) : (
                        <div className="space-y-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="text-xs opacity-70">
                                <tr className="text-left border-b border-black/10 dark:border-white/10">
                                  <th className="py-2 pr-2">ID</th>
                                  <th className="py-2 pr-2">Requested</th>
                                  <th className="py-2 pr-2">Completed</th>
                                  <th className="py-2 pr-2">Status</th>
                                  <th className="py-2 pr-2">Duration</th>
                                  <th className="py-2 pr-2">Error</th>
                                </tr>
                              </thead>
                              <tbody>
                                {attempts.map((a) => (
                                  <tr key={a.id} className="border-b border-black/5 dark:border-white/5">
                                    <td className="py-2 pr-2">
                                      <button
                                        className="underline underline-offset-2 opacity-90 hover:opacity-100"
                                        onClick={() => setSelectedAttemptId(a.id)}
                                      >
                                        {a.id}
                                      </button>
                                    </td>
                                    <td className="py-2 pr-2">{formatIso(a.requested_at) ?? "-"}</td>
                                    <td className="py-2 pr-2">{formatIso(a.completed_at) ?? "-"}</td>
                                    <td className="py-2 pr-2">
                                      <AttemptStatusBadge attempt={a} />
                                    </td>
                                    <td className="py-2 pr-2">
                                      {a.duration_ms != null ? `${a.duration_ms}ms` : "-"}
                                    </td>
                                    <td className="py-2 pr-2">
                                      {a.error_category ? (
                                        <div className="space-y-0.5">
                                          <div className="text-xs">{a.error_category}</div>
                                          {a.error_message ? (
                                            <div className="text-[11px] opacity-70 line-clamp-2">
                                              {a.error_message}
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {selectedAttemptId != null ? (
                            <AttemptDetail
                              attempt={attempts.find((a) => a.id === selectedAttemptId) ?? null}
                              onClose={() => setSelectedAttemptId(null)}
                            />
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Modal>
          ) : null}

          {loading ? <div className="text-sm opacity-70">{loading}</div> : null}
          {error ? (
            <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</div>
          ) : null}
        </section>
      </main>

      {onboardingOpen ? (
        <OnboardingModal
          hasToken
          onClose={() => setOnboardingOpen(false)}
          onStartTour={() => {
            setOnboardingOpen(false);
            setTourOpen(true);
          }}
          onGenerateDemo={async () => {
            try {
              setLoading("Generating demo data...");
              const dest = await ensureSeedDestination();
              setSelectedDestinationId(dest.id);
              await seedOneWebhook(dest.public_key);
              await refreshEvents(dest.id, 1);
              setEventsPage(1);
              setEventIdQuery("");
              toasts.push({ kind: "success", title: "Demo data created", detail: "1 webhook ingested" });
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setLoading(null);
            }
          }}
          onComplete={() => {
            const next = { ...(uiFlags ?? {}), onboarding_seen_v1: true };
            setUiFlags(next);
            apiUpdateUiFlags({ onboarding_seen_v1: true }).catch(() => {});
            setOnboardingOpen(false);
          }}
        />
      ) : null}

      {tourOpen ? (
        <TourCoachmarks
          onClose={() => {
            const next = { ...(uiFlags ?? {}), tour_seen_v1: true };
            setUiFlags(next);
            apiUpdateUiFlags({ tour_seen_v1: true }).catch(() => {});
            setTourOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function LogExportCard({
  scope,
  onScopeChange,
  fromLocal,
  onFromLocalChange,
  toLocal,
  onToLocalChange,
  selectedDestination,
  exportStatus,
  isStatusLoading,
  isCreating,
  onCreate,
}: {
  scope: "current" | "all";
  onScopeChange: (scope: "current" | "all") => void;
  fromLocal: string;
  onFromLocalChange: (value: string) => void;
  toLocal: string;
  onToLocalChange: (value: string) => void;
  selectedDestination: Destination | null;
  exportStatus: LogExportStatus | null;
  isStatusLoading: boolean;
  isCreating: boolean;
  onCreate: () => void;
}) {
  const status = exportStatus?.status ?? null;
  const ready = status === "completed" && exportStatus?.result != null;
  const canCreate = scope === "all" || selectedDestination != null;

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4" data-tour="log-export">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Download logs</div>
          <div className="mt-1 text-xs opacity-70">Export webhook events and attempts as JSONL.</div>
        </div>
        {status ? <LogExportStatusBadge status={status} /> : null}
      </div>

      <div className="mt-3 space-y-2">
        <label className="block">
          <span className="text-xs opacity-70">Scope</span>
          <select
            className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
            value={scope}
            onChange={(e) => onScopeChange(e.target.value as "current" | "all")}
          >
            <option value="current">
              Current destination{selectedDestination ? `: ${selectedDestination.name}` : ""}
            </option>
            <option value="all">All destinations</option>
          </select>
        </label>

        <div className="grid grid-cols-1 gap-2">
          <label className="block">
            <span className="text-xs opacity-70">Received from</span>
            <input
              className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
              type="datetime-local"
              value={fromLocal}
              onChange={(e) => onFromLocalChange(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs opacity-70">Received to</span>
            <input
              className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
              type="datetime-local"
              value={toLocal}
              onChange={(e) => onToLocalChange(e.target.value)}
            />
          </label>
        </div>

        <button
          className="w-full text-sm rounded-lg bg-black text-white dark:bg-white dark:text-black px-3 py-2 hover:opacity-90 disabled:opacity-50"
          disabled={!canCreate || isCreating}
          onClick={onCreate}
        >
          {isCreating ? "Queueing..." : "Create export"}
        </button>

        {!canCreate ? (
          <div className="text-xs text-amber-700 dark:text-amber-300">Select a destination or export all logs.</div>
        ) : null}
      </div>

      {exportStatus ? (
        <div className="mt-4 rounded-lg border border-black/10 dark:border-white/10 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">Job {exportStatus.export_id}</div>
            <div className="opacity-70">{isStatusLoading && !ready ? "checking..." : "latest status"}</div>
          </div>

          {exportStatus.failed_reason ? (
            <div className="mt-2 text-red-600 dark:text-red-400">{exportStatus.failed_reason}</div>
          ) : null}

          {exportStatus.result ? (
            <div className="mt-2 space-y-1 opacity-80">
              <div>{exportStatus.result.fileName}</div>
              <div>{formatBytes(exportStatus.result.bytes)} · expires {formatIso(exportStatus.result.expiresAt)}</div>
            </div>
          ) : (
            <div className="mt-2 opacity-70">The worker is preparing the export artifact.</div>
          )}

          <a
            className={`mt-3 inline-flex w-full items-center justify-center rounded-lg border px-3 py-2 text-sm ${
              ready
                ? "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                : "pointer-events-none border-black/5 opacity-40 dark:border-white/5"
            }`}
            href={ready ? `/api/core/v1/exports/logs/${exportStatus.export_id}/download` : "#"}
          >
            Download JSONL
          </a>
        </div>
      ) : null}
    </div>
  );
}

function LogExportStatusBadge({ status }: { status: string }) {
  const cls = status === "completed"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : status === "failed"
      ? "bg-red-500/15 text-red-700 dark:text-red-300"
      : "bg-sky-500/15 text-sky-700 dark:text-sky-300";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function isLogExportTerminal(status: string | null | undefined) {
  return status === "completed" || status === "failed";
}

function datetimeLocalToIso(value: string) {
  if (value.trim() === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function filteredEvents(events: EventRow[], filter: "all" | "ok" | "failed" | "pending" | "never") {
  if (filter === "all") return events;
  return events.filter((e) => {
    const a = e.latest_attempt;
    if (filter === "never") return !a;
    if (!a) return false;
    const pending = a.completed_at == null;
    const ok = !pending && (a.response_status ?? 0) >= 200 && (a.response_status ?? 0) < 300;
    const failed = !pending && !ok;
    if (filter === "pending") return pending;
    if (filter === "ok") return ok;
    if (filter === "failed") return failed;
    return true;
  });
}

function formatIso(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dtf.format(d);
}

function prettyBody(raw: string) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return raw;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return raw;
  }
}

function AttemptDetail({
  attempt,
  onClose,
}: {
  attempt: DeliveryAttempt | null;
  onClose: () => void;
}) {
  if (!attempt) return null;

  const headersText = JSON.stringify(attempt.response_headers ?? {}, null, 2);
  const bodyText = attempt.response_body ?? "";

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium">
          Attempt {attempt.id} response {attempt.response_status ?? ""}
        </div>
        <button
          className="text-[11px] rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <Info label="content_type" value={attempt.response_content_type ?? "-"} />
        <Info label="status" value={String(attempt.response_status ?? "-")} mono />
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <div className="flex items-center justify-between gap-2 text-xs font-medium mb-1">
            <div>Response headers</div>
            <button
              className="text-[11px] rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => navigator.clipboard?.writeText(headersText).catch(() => {})}
            >
              Copy
            </button>
          </div>
          <pre className="text-[11px] rounded-lg border border-black/10 dark:border-white/10 p-3 overflow-auto max-h-56">
            {headersText}
          </pre>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 text-xs font-medium mb-1">
            <div>Response body</div>
            <button
              className="text-[11px] rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => navigator.clipboard?.writeText(bodyText).catch(() => {})}
            >
              Copy
            </button>
          </div>
          <pre className="text-[11px] rounded-lg border border-black/10 dark:border-white/10 p-3 overflow-auto max-h-56">
            {prettyBody(bodyText)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] overflow-auto rounded-2xl bg-white text-black dark:bg-black dark:text-white"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function OnboardingModal({
  hasToken,
  onClose,
  onStartTour,
  onGenerateDemo,
  onComplete,
}: {
  hasToken: boolean;
  onClose: () => void;
  onStartTour: () => void;
  onGenerateDemo: () => void | Promise<void>;
  onComplete: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs opacity-70">Welcome to</div>
            <div className="text-2xl font-semibold tracking-tight">Webhook Replay</div>
            <div className="mt-2 text-sm opacity-80 max-w-2xl">
              Ingest webhooks, inspect the exact request, and replay deliveries with audit visibility.
            </div>
          </div>
          <button
            className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-[1.2fr_.8fr] gap-4">
          <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4">
            <div className="text-xs font-medium opacity-70">Fast start</div>
            <div className="mt-1 font-semibold">Generate demo data</div>
            <div className="mt-2 text-sm opacity-80">
              We’ll create a local destination and ingest a sample webhook so you can explore the UI immediately.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="text-sm rounded-lg bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 hover:opacity-90"
                onClick={onGenerateDemo}
              >
                Generate sample webhook
              </button>
              <button
                className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                onClick={onStartTour}
                disabled={!hasToken}
              >
                Take the tour (30s)
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4">
            <div className="text-xs font-medium opacity-70">What you can do</div>
            <ul className="mt-2 space-y-2 text-sm opacity-85">
              <li>
                <span className="font-semibold">Destinations</span> → create targets and ingest URLs
              </li>
              <li>
                <span className="font-semibold">Events</span> → inspect headers + raw body
              </li>
              <li>
                <span className="font-semibold">Replay</span> → retry and watch attempts live
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="text-xs opacity-70">
            Tip: Press <span className="font-mono">Esc</span> to close modals.
          </div>
          <div className="flex gap-2">
            <button
              className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
              onClick={onStartTour}
              disabled={!hasToken}
              title={!hasToken ? "Log in to start the tour" : undefined}
            >
              Start tour
            </button>
            <button
              className="text-sm rounded-lg bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 hover:opacity-90"
              onClick={onComplete}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TourCoachmarks({ onClose }: { onClose: () => void }) {
  const steps = useMemo(
    () => [
      {
        selector: '[data-tour="destination-select"]',
        title: "1/5 Destinations",
        body: "Select a destination. Each destination has an ingest URL and a replay target.",
      },
      {
        selector: '[data-tour="ingest-copy"]',
        title: "2/5 Ingest URL",
        body: "Copy the ingest URL and POST JSON to it. Events show up on the right.",
      },
      {
        selector: '[data-tour="events-table"]',
        title: "3/5 Events table",
        body: "Click any event row to open the detail modal (headers/body/attempts).",
      },
      {
        selector: '[data-tour="event-replay"]',
        title: "4/5 Replay",
        body: "Replay re-sends the stored payload to the destination target_url.",
      },
      {
        selector: '[data-tour="help"]',
        title: "5/5 Help",
        body: "You can re-open onboarding & the tour anytime from here.",
      },
    ],
    []
  );

  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [placement, setPlacement] = useState<"bottom" | "right" | "left">("bottom");

  const recompute = () => {
    const s = steps[idx];
    const el = s ? (document.querySelector(s.selector) as HTMLElement | null) : null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.top, width: r.width, height: r.height });

    const roomRight = window.innerWidth - (r.right + 16);
    const roomLeft = r.left - 16;
    const roomBottom = window.innerHeight - (r.bottom + 16);
    if (roomRight > 380) setPlacement("right");
    else if (roomLeft > 380) setPlacement("left");
    else if (roomBottom > 240) setPlacement("bottom");
    else setPlacement("bottom");
  };

  useLayoutEffect(() => {
    const s = steps[idx];
    const el = s ? (document.querySelector(s.selector) as HTMLElement | null) : null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const id = window.setTimeout(recompute, 50);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, steps]);

  useEffect(() => {
    const onResize = () => recompute();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const step = steps[idx]!;
  const tipStyle: React.CSSProperties =
    rect != null
      ? placement === "right"
        ? {
            left: Math.min(window.innerWidth - 360, rect.left + rect.width + 18),
            top: Math.min(window.innerHeight - 240, Math.max(16, rect.top - 6)),
          }
        : placement === "left"
          ? {
              left: Math.max(16, rect.left - 18 - 340),
              top: Math.min(window.innerHeight - 240, Math.max(16, rect.top - 6)),
            }
          : {
              left: Math.min(window.innerWidth - 360, Math.max(16, rect.left)),
              top: Math.min(window.innerHeight - 260, rect.top + rect.height + 16),
            }
      : { left: 16, top: 16 };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onMouseDown={onClose} />
      {rect ? (
        <div
          className="absolute rounded-2xl ring-2 ring-sky-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] animate-[pulse_2.2s_ease-in-out_infinite]"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      ) : null}

      <div
        className="absolute w-[340px] rounded-2xl border border-white/10 bg-black/70 text-white p-4 shadow-2xl"
        style={tipStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Arrow */}
        {rect ? (
          <div
            className="absolute h-3 w-3 rotate-45 bg-black/70 border border-white/10"
            style={
              placement === "right"
                ? { left: -6, top: 18 }
                : placement === "left"
                  ? { right: -6, top: 18 }
                  : { left: 22, top: -6 }
            }
          />
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs opacity-70">{step.title}</div>
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={
                  i === idx
                    ? "h-1.5 w-4 rounded-full bg-white"
                    : "h-1.5 w-1.5 rounded-full bg-white/35"
                }
              />
            ))}
          </div>
        </div>
        <div className="mt-2 text-sm leading-relaxed opacity-95">{step.body}</div>
        <div className="mt-4 flex items-center justify-between">
          <button
            className="text-sm rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
            disabled={idx === 0}
            onClick={() => setIdx((v) => Math.max(0, v - 1))}
          >
            Back
          </button>
          <div className="flex gap-2">
            <button
              className="text-sm rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/10"
              onClick={onClose}
            >
              Skip
            </button>
            <button
              className="text-sm rounded-lg bg-white text-black px-3 py-1.5 hover:opacity-90"
              onClick={() => {
                if (idx === steps.length - 1) onClose();
                else setIdx((v) => v + 1);
              }}
            >
              {idx === steps.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
      <div className="opacity-70">{label}</div>
      <div className={mono ? "font-mono break-all" : "break-all"}>{value}</div>
    </div>
  );
}

function AttemptStatusBadge({ attempt }: { attempt: DeliveryAttempt }) {
  const pending = attempt.completed_at == null;
  const ok = !pending && (attempt.response_status ?? 0) >= 200 && (attempt.response_status ?? 0) < 300;

  const label = pending
    ? "pending"
    : ok
      ? `${attempt.response_status}`
      : `${attempt.response_status ?? "error"}`;
  const cls = pending
    ? "bg-black/5 dark:bg-white/10"
    : ok
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : "bg-red-500/15 text-red-700 dark:text-red-300";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function EventAttemptBadge({ attempt }: { attempt: DeliveryAttempt | null }) {
  if (!attempt) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-black/5 dark:bg-white/10">
        —
      </span>
    );
  }
  return <AttemptStatusBadge attempt={attempt} />;
}

function CreateDestinationCard({
  onCreate,
  loading,
}: {
  onCreate: (name: string, target_url: string) => Promise<void>;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
      <div className="font-semibold mb-2">Create destination</div>
      <div className="space-y-2">
        <input
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
          placeholder="Name (e.g. Local echo)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
          placeholder="Target URL (e.g. http://host.docker.internal:4000/echo)"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
        />
        <button
          className="w-full text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
          disabled={loading || name.trim() === "" || targetUrl.trim() === ""}
          onClick={() => {
            setError(null);
            onCreate(name.trim(), targetUrl.trim())
              .then(() => {
                setName("");
                setTargetUrl("");
              })
              .catch((e) => setError(String(e?.message ?? e)));
          }}
        >
          Create
        </button>
        {error ? (
          <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</div>
        ) : null}
      </div>
    </div>
  );
}

function DestinationEditor({
  destination,
  disabled,
  onUpdate,
  onDelete,
}: {
  destination: Destination;
  disabled: boolean;
  onUpdate: (name: string, targetUrl: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(destination.name);
  const [targetUrl, setTargetUrl] = useState(destination.target_url);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setName(destination.name);
    setTargetUrl(destination.target_url);
    setLocalError(null);
  }, [destination.id, destination.name, destination.target_url]);

  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium">Edit</div>
      <input
        className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        disabled={disabled}
      />
      <input
        className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
        value={targetUrl}
        onChange={(e) => setTargetUrl(e.target.value)}
        placeholder="Target URL"
        disabled={disabled}
      />
      <div className="flex gap-2">
        <button
          className="flex-1 text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
          disabled={disabled || name.trim() === "" || targetUrl.trim() === ""}
          onClick={() => {
            setLocalError(null);
            onUpdate(name.trim(), targetUrl.trim()).catch((e) => setLocalError(String(e?.message ?? e)));
          }}
        >
          Save
        </button>
        <button
          className="text-sm rounded-lg border border-red-500/30 text-red-700 dark:text-red-300 px-3 py-2 hover:bg-red-500/10 disabled:opacity-50"
          disabled={disabled}
          onClick={() => {
            setLocalError(null);
            onDelete().catch((e) => setLocalError(String(e?.message ?? e)));
          }}
        >
          Delete
        </button>
      </div>
      {localError ? (
        <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">{localError}</div>
      ) : null}
    </div>
  );
}

