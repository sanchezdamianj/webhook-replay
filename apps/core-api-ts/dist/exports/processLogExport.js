import fs from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";
import { and, asc, desc, eq, gte, inArray, lt, lte, or } from "drizzle-orm";
import { deliveryAttempts, destinations, webhookEvents } from "../db/schema.js";
const mkdir = fs.promises.mkdir;
const stat = fs.promises.stat;
function clampDate(d) {
    if (!d)
        return null;
    if (Number.isNaN(d.getTime()))
        return null;
    return d;
}
function parseIsoDate(s) {
    if (!s)
        return null;
    return clampDate(new Date(s));
}
async function ensureDir(dir) {
    await mkdir(dir, { recursive: true });
    const st = await stat(dir);
    if (!st.isDirectory())
        throw new Error(`EXPORT_DIR is not a directory: ${dir}`);
}
async function writeLine(stream, line) {
    if (stream.write(line))
        return;
    await new Promise((resolve, reject) => {
        stream.once("drain", resolve);
        stream.once("error", reject);
    });
}
export async function processLogExport(deps, jobId, data) {
    const exportDir = deps.env.EXPORT_DIR;
    await ensureDir(exportDir);
    const fileName = `logs_account_${data.accountId}_${jobId}.jsonl`;
    const filePath = path.join(exportDir, fileName);
    const ws = fs.createWriteStream(filePath, { encoding: "utf8" });
    let bytes = 0;
    ws.on("error", (e) => {
        throw e;
    });
    const from = parseIsoDate(data.receivedAtFrom);
    const to = parseIsoDate(data.receivedAtTo);
    const PAGE_SIZE = 500;
    let cursorReceivedAt = null;
    let cursorId = null;
    // Cursor pagination on (received_at desc, id desc).
    while (true) {
        const conditions = [];
        conditions.push(eq(destinations.accountId, data.accountId));
        if (data.destinationId != null)
            conditions.push(eq(webhookEvents.destinationId, data.destinationId));
        if (from)
            conditions.push(gte(webhookEvents.receivedAt, from));
        if (to)
            conditions.push(lte(webhookEvents.receivedAt, to));
        if (cursorReceivedAt && cursorId) {
            const cursorCond = or(lt(webhookEvents.receivedAt, cursorReceivedAt), and(eq(webhookEvents.receivedAt, cursorReceivedAt), lt(webhookEvents.id, cursorId)));
            if (cursorCond)
                conditions.push(cursorCond);
        }
        const evRows = await deps.db
            .select({ ev: webhookEvents, dest: destinations })
            .from(webhookEvents)
            .innerJoin(destinations, eq(webhookEvents.destinationId, destinations.id))
            .where(and(...conditions))
            .orderBy(desc(webhookEvents.receivedAt), desc(webhookEvents.id))
            .limit(PAGE_SIZE);
        if (evRows.length === 0)
            break;
        const eventIds = evRows.map((r) => r.ev.id);
        const attemptRows = eventIds.length > 0
            ? await deps.db
                .select()
                .from(deliveryAttempts)
                .where(inArray(deliveryAttempts.webhookEventId, eventIds))
                .orderBy(asc(deliveryAttempts.requestedAt))
            : [];
        const attemptsByEvent = new Map();
        for (const a of attemptRows) {
            const arr = attemptsByEvent.get(a.webhookEventId) ?? [];
            arr.push(a);
            attemptsByEvent.set(a.webhookEventId, arr);
        }
        for (const { ev, dest } of evRows) {
            const record = {
                event: {
                    id: ev.id,
                    destination: { id: dest.id, name: dest.name, public_key: dest.publicKey },
                    received_at: ev.receivedAt?.toISOString?.() ?? null,
                    http_method: ev.httpMethod,
                    request_path: ev.requestPath,
                    headers: ev.headers,
                    raw_body: ev.rawBody,
                    content_type: ev.contentType,
                    source_ip: ev.sourceIp,
                    idempotency_key: ev.idempotencyKey,
                    created_at: ev.createdAt?.toISOString?.() ?? null,
                    updated_at: ev.updatedAt?.toISOString?.() ?? null,
                },
                attempts: (attemptsByEvent.get(ev.id) ?? []).map((a) => ({
                    id: a.id,
                    kind: a.kind,
                    requested_at: a.requestedAt?.toISOString?.() ?? null,
                    completed_at: a.completedAt?.toISOString?.() ?? null,
                    response_status: a.responseStatus,
                    error_category: a.errorCategory,
                    error_message: a.errorMessage,
                    duration_ms: a.durationMs,
                    attempt_number: a.attemptNumber,
                    retry_of_id: a.retryOfId,
                    idempotency_key: a.idempotencyKey,
                    response_headers: a.responseHeaders,
                    response_body: a.responseBody,
                    response_content_type: a.responseContentType,
                    created_at: a.createdAt?.toISOString?.() ?? null,
                    updated_at: a.updatedAt?.toISOString?.() ?? null,
                })),
            };
            const line = JSON.stringify(record) + "\n";
            bytes += Buffer.byteLength(line, "utf8");
            await writeLine(ws, line);
        }
        const last = evRows[evRows.length - 1].ev;
        cursorReceivedAt = last.receivedAt;
        cursorId = last.id;
    }
    ws.end();
    await finished(ws);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + deps.env.EXPORT_TTL_HOURS * 60 * 60 * 1000);
    return {
        format: "jsonl",
        filePath,
        fileName,
        bytes,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
    };
}
