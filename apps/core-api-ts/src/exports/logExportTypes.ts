import type { deliveryAttempts, destinations, webhookEvents } from "../db/schema.js";

export type LogExportFilters = {
  accountId: number;
  destinationId: number | null;
  receivedAtFrom: Date | null;
  receivedAtTo: Date | null;
};

export type LogExportCursor = {
  receivedAt: Date;
  id: number;
};

export type LogExportEventRow = {
  event: typeof webhookEvents.$inferSelect;
  destination: typeof destinations.$inferSelect;
  attempts: (typeof deliveryAttempts.$inferSelect)[];
};

export type LogExportRecord = {
  event: {
    id: number;
    destination: {
      id: number;
      name: string;
      public_key: string;
    };
    received_at: string | null;
    http_method: string;
    request_path: string | null;
    headers: unknown;
    raw_body: string;
    content_type: string | null;
    source_ip: string | null;
    idempotency_key: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  attempts: Array<{
    id: number;
    kind: string;
    requested_at: string | null;
    completed_at: string | null;
    response_status: number | null;
    error_category: string | null;
    error_message: string | null;
    duration_ms: number | null;
    attempt_number: number;
    retry_of_id: number | null;
    idempotency_key: string | null;
    response_headers: unknown;
    response_body: string | null;
    response_content_type: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
};
