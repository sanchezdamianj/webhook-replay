export function serializeAttempt(a) {
    return {
        id: a.id,
        webhook_event_id: a.webhookEventId,
        destination_id: a.destinationId,
        kind: a.kind,
        attempt_number: a.attemptNumber,
        retry_of_id: a.retryOfId,
        requested_at: a.requestedAt?.toISOString?.() ?? null,
        completed_at: a.completedAt?.toISOString?.() ?? null,
        response_status: a.responseStatus,
        response_content_type: a.responseContentType,
        response_headers: a.responseHeaders ?? {},
        response_body: a.responseBody,
        error_category: a.errorCategory,
        error_message: a.errorMessage,
        duration_ms: a.durationMs,
    };
}
