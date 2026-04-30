import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    email: text("email").notNull(),
    passwordDigest: text("password_digest").notNull(),
    uiFlags: jsonb("ui_flags").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("index_users_on_email").on(t.email)]
);

export const memberships = pgTable(
  "memberships",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    accountId: bigint("account_id", { mode: "number" })
      .notNull()
      .references(() => accounts.id),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("index_memberships_on_account_id_and_user_id").on(t.accountId, t.userId)]
);

export const destinations = pgTable(
  "destinations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicKey: uuid("public_key").notNull().defaultRandom(),
    name: text("name").notNull(),
    targetUrl: text("target_url").notNull(),
    accountId: bigint("account_id", { mode: "number" })
      .notNull()
      .references(() => accounts.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("index_destinations_on_public_key").on(t.publicKey), index("index_destinations_on_account_id").on(t.accountId)]
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    destinationId: bigint("destination_id", { mode: "number" })
      .notNull()
      .references(() => destinations.id),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    httpMethod: text("http_method").notNull(),
    requestPath: text("request_path"),
    headers: jsonb("headers").notNull().default(sql`'{}'::jsonb`),
    rawBody: text("raw_body").notNull().default(""),
    contentType: text("content_type"),
    sourceIp: text("source_ip"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("index_webhook_events_on_destination_id").on(t.destinationId),
    index("index_webhook_events_on_received_at").on(t.receivedAt),
  ]
);

export const deliveryAttempts = pgTable(
  "delivery_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    webhookEventId: bigint("webhook_event_id", { mode: "number" })
      .notNull()
      .references(() => webhookEvents.id),
    destinationId: bigint("destination_id", { mode: "number" })
      .notNull()
      .references(() => destinations.id),
    kind: text("kind").notNull().default("replay"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    responseStatus: integer("response_status"),
    errorCategory: text("error_category"),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    attemptNumber: integer("attempt_number").notNull().default(1),
    retryOfId: bigint("retry_of_id", { mode: "number" }),
    idempotencyKey: text("idempotency_key"),
    responseHeaders: jsonb("response_headers").notNull().default(sql`'{}'::jsonb`),
    responseBody: text("response_body"),
    responseContentType: text("response_content_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("index_delivery_attempts_on_webhook_event_id").on(t.webhookEventId),
    index("index_delivery_attempts_on_destination_id").on(t.destinationId),
    index("index_delivery_attempts_on_destination_id_and_requested_at").on(t.destinationId, t.requestedAt),
    index("index_delivery_attempts_on_retry_of_id").on(t.retryOfId),
  ]
);
