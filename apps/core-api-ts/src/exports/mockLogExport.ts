export function mockLogExportFileName(accountId: number): string {
  return `mock_logs_account_${accountId}.jsonl`;
}

export function buildMockLogExportJsonl(accountId: number): string {
  const now = new Date();
  const earlier = new Date(now.getTime() - 60_000);

  return [
    {
      event: {
        id: 9001,
        destination: { id: 101, name: "Mock receiver", public_key: "mock-public-key" },
        received_at: earlier.toISOString(),
        http_method: "POST",
        request_path: "/webhook/mock-public-key",
        headers: { "content-type": "application/json", "x-mock-account": String(accountId) },
        raw_body: JSON.stringify({ type: "invoice.paid", amount: 4200 }),
        content_type: "application/json",
        source_ip: "127.0.0.1",
        idempotency_key: "mock-event-9001",
        created_at: earlier.toISOString(),
        updated_at: earlier.toISOString(),
      },
      attempts: [
        {
          id: 7001,
          kind: "replay",
          requested_at: now.toISOString(),
          completed_at: now.toISOString(),
          response_status: 200,
          error_category: null,
          error_message: null,
          duration_ms: 34,
          attempt_number: 1,
          retry_of_id: null,
          idempotency_key: "mock-replay-7001",
          response_headers: { "content-type": "application/json" },
          response_body: JSON.stringify({ ok: true }),
          response_content_type: "application/json",
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      ],
    },
    {
      event: {
        id: 9002,
        destination: { id: 101, name: "Mock receiver", public_key: "mock-public-key" },
        received_at: now.toISOString(),
        http_method: "POST",
        request_path: "/webhook/mock-public-key",
        headers: { "content-type": "application/json" },
        raw_body: JSON.stringify({ type: "customer.created", customer_id: "cus_mock" }),
        content_type: "application/json",
        source_ip: "127.0.0.1",
        idempotency_key: "mock-event-9002",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      attempts: [],
    },
  ].map((record) => JSON.stringify(record)).join("\n") + "\n";
}
