import type { LogExportEventRow, LogExportRecord } from "./logExportTypes.js";

export function toLogExportRecord(row: LogExportEventRow): LogExportRecord {
  const { event, destination, attempts } = row;

  return {
    event: {
      id: event.id,
      destination: { id: destination.id, name: destination.name, public_key: destination.publicKey },
      received_at: event.receivedAt?.toISOString?.() ?? null,
      http_method: event.httpMethod,
      request_path: event.requestPath,
      headers: event.headers,
      raw_body: event.rawBody,
      content_type: event.contentType,
      source_ip: event.sourceIp,
      idempotency_key: event.idempotencyKey,
      created_at: event.createdAt?.toISOString?.() ?? null,
      updated_at: event.updatedAt?.toISOString?.() ?? null,
    },
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      kind: attempt.kind,
      requested_at: attempt.requestedAt?.toISOString?.() ?? null,
      completed_at: attempt.completedAt?.toISOString?.() ?? null,
      response_status: attempt.responseStatus,
      error_category: attempt.errorCategory,
      error_message: attempt.errorMessage,
      duration_ms: attempt.durationMs,
      attempt_number: attempt.attemptNumber,
      retry_of_id: attempt.retryOfId,
      idempotency_key: attempt.idempotencyKey,
      response_headers: attempt.responseHeaders,
      response_body: attempt.responseBody,
      response_content_type: attempt.responseContentType,
      created_at: attempt.createdAt?.toISOString?.() ?? null,
      updated_at: attempt.updatedAt?.toISOString?.() ?? null,
    })),
  };
}
