export type Destination = {
  id: number;
  public_key: string;
  name: string;
  target_url: string;
};

export type EventRow = {
  id: number;
  destination: { id: number; name: string; public_key: string };
  received_at: string | null;
  http_method: string;
  content_type: string | null;
  latest_attempt: DeliveryAttempt | null;
};

export type EventDetail = {
  id: number;
  destination_id: number;
  received_at: string | null;
  http_method: string;
  request_path: string | null;
  headers: Record<string, unknown>;
  raw_body: string;
  content_type: string | null;
  source_ip: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DeliveryAttempt = {
  id: number;
  webhook_event_id: number;
  destination_id: number;
  kind: string;
  attempt_number: number;
  retry_of_id: number | null;
  requested_at: string | null;
  completed_at: string | null;
  response_status: number | null;
  response_content_type?: string | null;
  response_headers?: Record<string, string>;
  response_body?: string | null;
  error_category: string | null;
  error_message: string | null;
  duration_ms: number | null;
};

