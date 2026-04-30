import type { LogExportJobData } from "../jobs/logExportQueue.js";
import type { LogExportFilters } from "./logExportTypes.js";

function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toLogExportFilters(data: LogExportJobData): LogExportFilters {
  return {
    accountId: data.accountId,
    destinationId: data.destinationId ?? null,
    receivedAtFrom: parseIsoDate(data.receivedAtFrom),
    receivedAtTo: parseIsoDate(data.receivedAtTo),
  };
}
