import { eq, sql } from "drizzle-orm";
import { deliveryAttempts, destinations, webhookEvents } from "../db/schema.js";
import { publishDeliveryAttempt } from "../realtime/publisher.js";
function extractFetchHeaders(headers) {
    const out = {};
    headers.forEach((v, k) => {
        out[k] = v;
    });
    return out;
}
function truncateBody(body, maxBytes) {
    if (body == null)
        return null;
    const buf = Buffer.byteLength(body, "utf8");
    if (buf <= maxBytes)
        return body;
    return body.slice(0, maxBytes) + "\n...truncated...\n";
}
export async function processDeliveryAttempt(deps, deliveryAttemptId) {
    const { db, redis, replayQueue, env } = deps;
    const [attemptRow] = await db.select().from(deliveryAttempts).where(eq(deliveryAttempts.id, deliveryAttemptId)).limit(1);
    if (!attemptRow)
        return;
    const [destination] = await db
        .select()
        .from(destinations)
        .where(eq(destinations.id, attemptRow.destinationId))
        .limit(1);
    const [event] = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.id, attemptRow.webhookEventId))
        .limit(1);
    if (!destination || !event)
        return;
    const started = performance.now();
    let responseStatus = null;
    let errorCategory = null;
    let errorMessage = null;
    let responseHeaders = {};
    let responseBody = null;
    let responseContentType = null;
    try {
        const target = destination.targetUrl;
        const url = new URL(target);
        const ac = new AbortController();
        const timeoutMs = 11_000;
        const t = setTimeout(() => ac.abort(), timeoutMs);
        const headersInit = {
            "X-Webhook-Replay-Event-Id": String(event.id),
        };
        if (event.contentType)
            headersInit["Content-Type"] = event.contentType;
        let res;
        try {
            res = await fetch(url.toString(), {
                method: "POST",
                headers: headersInit,
                body: event.rawBody ?? "",
                signal: ac.signal,
            });
        }
        finally {
            clearTimeout(t);
        }
        responseStatus = res.status;
        responseContentType = res.headers.get("content-type");
        responseHeaders = extractFetchHeaders(res.headers);
        const text = await res.text();
        responseBody = truncateBody(text, env.REPLAY_MAX_RESPONSE_BYTES);
        if (responseStatus >= 500)
            errorCategory = "server";
        else if (responseStatus >= 400)
            errorCategory = "client";
        else
            errorCategory = null;
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (e instanceof Error && e.name === "AbortError") {
            errorCategory = "timeout";
            errorMessage = msg;
        }
        else {
            errorCategory = "network";
            errorMessage = `${e instanceof Error ? e.constructor.name : "Error"}: ${msg}`;
        }
    }
    const durationMs = Math.round(performance.now() - started);
    const [updated] = await db
        .update(deliveryAttempts)
        .set({
        responseStatus,
        errorCategory,
        errorMessage,
        durationMs,
        responseHeaders,
        responseBody,
        responseContentType,
        completedAt: sql `now()`,
        updatedAt: sql `now()`,
    })
        .where(eq(deliveryAttempts.id, deliveryAttemptId))
        .returning();
    if (!updated)
        return;
    await publishDeliveryAttempt(redis, updated.webhookEventId, updated);
    await maybeScheduleRetry(deps, updated, responseStatus, errorCategory);
}
async function maybeScheduleRetry(deps, attempt, responseStatus, errorCategory) {
    const { db, redis, replayQueue, env } = deps;
    const maxRetries = env.REPLAY_MAX_RETRIES;
    if (attempt.attemptNumber >= maxRetries + 1)
        return;
    const retryable = errorCategory === "timeout" ||
        errorCategory === "network" ||
        errorCategory === "server" ||
        (responseStatus != null && responseStatus >= 500);
    if (!retryable)
        return;
    const nextAttemptNumber = attempt.attemptNumber + 1;
    const backoffSeconds = env.REPLAY_BASE_BACKOFF_SECONDS * 2 ** (attempt.attemptNumber - 1);
    const rootId = attempt.retryOfId ?? attempt.id;
    const now = new Date();
    const [created] = await db
        .insert(deliveryAttempts)
        .values({
        webhookEventId: attempt.webhookEventId,
        destinationId: attempt.destinationId,
        kind: "retry",
        requestedAt: now,
        attemptNumber: nextAttemptNumber,
        retryOfId: rootId,
        createdAt: now,
        updatedAt: now,
    })
        .returning();
    if (!created)
        return;
    await publishDeliveryAttempt(redis, created.webhookEventId, created);
    await replayQueue.add("replay", { deliveryAttemptId: created.id }, { delay: Math.round(backoffSeconds * 1000) });
}
