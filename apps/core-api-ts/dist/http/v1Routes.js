import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { decodeToken, encodeToken } from "../auth/jwt.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { accounts, deliveryAttempts, destinations, memberships, users, webhookEvents, } from "../db/schema.js";
import { publishDeliveryAttempt } from "../realtime/publisher.js";
import { serializeAttempt } from "../serialize.js";
import fs from "node:fs";
const PAGE_SIZE = 50;
async function authenticate(req, reply, deps) {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
    if (!token) {
        await reply.code(401).send({ error: "unauthorized" });
        return null;
    }
    let payload;
    try {
        payload = decodeToken(deps.env, token);
    }
    catch {
        await reply.code(401).send({ error: "unauthorized" });
        return null;
    }
    const [user] = await deps.db.select().from(users).where(eq(users.id, payload.user_id)).limit(1);
    if (!user) {
        await reply.code(401).send({ error: "unauthorized" });
        return null;
    }
    const [membership] = await deps.db
        .select()
        .from(memberships)
        .where(and(eq(memberships.userId, user.id), eq(memberships.accountId, payload.account_id)))
        .limit(1);
    if (!membership) {
        await reply.code(403).send({ error: "no_account" });
        return null;
    }
    const [account] = await deps.db.select().from(accounts).where(eq(accounts.id, payload.account_id)).limit(1);
    if (!account) {
        await reply.code(403).send({ error: "no_account" });
        return null;
    }
    return { user, account };
}
export async function registerV1Routes(app, deps) {
    const { db, env, replayQueue, logExportQueue, redis } = deps;
    app.get("/v1/status", async (_req, reply) => {
        await reply.send({ ok: true, service: "core-api" });
    });
    app.post("/v1/auth/signup", async (req, reply) => {
        const body = req.body;
        const email = typeof body.email === "string" ? body.email : "";
        const password = typeof body.password === "string" ? body.password : "";
        const account_name = typeof body.account_name === "string" ? body.account_name : "";
        if (!email || !password || !account_name) {
            await reply.code(422).send({ error: "validation_error", details: { base: ["missing fields"] } });
            return;
        }
        try {
            const passwordDigest = await hashPassword(password);
            const result = await db.transaction(async (tx) => {
                const now = new Date();
                const [user] = await tx
                    .insert(users)
                    .values({ email, passwordDigest, createdAt: now, updatedAt: now })
                    .returning();
                const [account] = await tx
                    .insert(accounts)
                    .values({ name: account_name, createdAt: now, updatedAt: now })
                    .returning();
                await tx.insert(memberships).values({
                    userId: user.id,
                    accountId: account.id,
                    role: "owner",
                    createdAt: now,
                    updatedAt: now,
                });
                return { user: user, account: account };
            });
            const token = encodeToken(env, { user_id: result.user.id, account_id: result.account.id });
            await reply.code(201).send({
                token,
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    ui_flags: result.user.uiFlags ?? {},
                },
                account: { id: result.account.id, name: result.account.name },
            });
        }
        catch (e) {
            const code = e?.code;
            if (code === "23505") {
                await reply.code(422).send({
                    error: "validation_error",
                    details: { email: ["has already been taken"] },
                });
                return;
            }
            throw e;
        }
    });
    app.post("/v1/auth/login", async (req, reply) => {
        const body = req.body;
        const email = typeof body.email === "string" ? body.email : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!email || !password) {
            await reply.code(422).send({ error: "validation_error", details: { base: ["missing fields"] } });
            return;
        }
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user) {
            await reply.code(404).send({ error: "not_found" });
            return;
        }
        const ok = await verifyPassword(password, user.passwordDigest);
        if (!ok) {
            await reply.code(401).send({ error: "invalid_credentials" });
            return;
        }
        const [membership] = await db.select().from(memberships).where(eq(memberships.userId, user.id)).limit(1);
        if (!membership) {
            await reply.code(403).send({ error: "no_account" });
            return;
        }
        const [account] = await db.select().from(accounts).where(eq(accounts.id, membership.accountId)).limit(1);
        if (!account) {
            await reply.code(403).send({ error: "no_account" });
            return;
        }
        const token = encodeToken(env, { user_id: user.id, account_id: account.id });
        await reply.send({
            token,
            user: { id: user.id, email: user.email, ui_flags: user.uiFlags ?? {} },
            account: { id: account.id, name: account.name },
        });
    });
    app.get("/v1/me", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        await reply.send({
            user: {
                id: ctx.user.id,
                email: ctx.user.email,
                ui_flags: ctx.user.uiFlags ?? {},
            },
            account: { id: ctx.account.id, name: ctx.account.name },
        });
    });
    app.patch("/v1/me/ui_flags", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const body = req.body;
        const incoming = body.ui_flags;
        if (incoming == null || typeof incoming !== "object" || Array.isArray(incoming)) {
            await reply.code(422).send({ error: "validation_error", details: { ui_flags: ["required"] } });
            return;
        }
        const prev = ctx.user.uiFlags ?? {};
        const nextFlags = { ...prev, ...incoming };
        const [updated] = await db
            .update(users)
            .set({ uiFlags: nextFlags, updatedAt: sql `now()` })
            .where(eq(users.id, ctx.user.id))
            .returning();
        await reply.send({ ok: true, ui_flags: updated?.uiFlags ?? {} });
    });
    app.get("/v1/destinations", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const rows = await db
            .select()
            .from(destinations)
            .where(eq(destinations.accountId, ctx.account.id))
            .orderBy(desc(destinations.createdAt));
        await reply.send(rows.map((d) => ({
            id: d.id,
            public_key: d.publicKey,
            name: d.name,
            target_url: d.targetUrl,
            created_at: d.createdAt?.toISOString?.() ?? null,
            updated_at: d.updatedAt?.toISOString?.() ?? null,
        })));
    });
    app.get("/v1/destinations/:id", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            await reply.code(404).send({ error: "not_found" });
            return;
        }
        const [d] = await db
            .select()
            .from(destinations)
            .where(and(eq(destinations.id, id), eq(destinations.accountId, ctx.account.id)))
            .limit(1);
        if (!d) {
            await reply.code(404).send({ error: "not_found" });
            return;
        }
        await reply.send({
            id: d.id,
            public_key: d.publicKey,
            name: d.name,
            target_url: d.targetUrl,
            created_at: d.createdAt?.toISOString?.() ?? null,
            updated_at: d.updatedAt?.toISOString?.() ?? null,
        });
    });
    app.post("/v1/destinations", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const dest = req.body?.destination;
        const name = dest?.name ?? "";
        const target_url = dest?.target_url ?? "";
        if (!name || !target_url) {
            await reply.code(422).send({ error: "validation_error", details: { destination: ["invalid"] } });
            return;
        }
        const now = new Date();
        const [created] = await db
            .insert(destinations)
            .values({
            name,
            targetUrl: target_url,
            accountId: ctx.account.id,
            createdAt: now,
            updatedAt: now,
        })
            .returning();
        await reply.code(201).send({
            id: created.id,
            public_key: created.publicKey,
            name: created.name,
            target_url: created.targetUrl,
            created_at: created.createdAt?.toISOString?.() ?? null,
            updated_at: created.updatedAt?.toISOString?.() ?? null,
        });
    });
    app.patch("/v1/destinations/:id", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const id = Number(req.params.id);
        const destBody = req.body?.destination;
        const [existing] = await db
            .select()
            .from(destinations)
            .where(and(eq(destinations.id, id), eq(destinations.accountId, ctx.account.id)))
            .limit(1);
        if (!existing) {
            await reply.code(404).send({ error: "not_found" });
            return;
        }
        const name = destBody?.name ?? existing.name;
        const target_url = destBody?.target_url ?? existing.targetUrl;
        const [updated] = await db
            .update(destinations)
            .set({ name, targetUrl: target_url, updatedAt: sql `now()` })
            .where(and(eq(destinations.id, id), eq(destinations.accountId, ctx.account.id)))
            .returning();
        await reply.send({
            id: updated.id,
            public_key: updated.publicKey,
            name: updated.name,
            target_url: updated.targetUrl,
            created_at: updated.createdAt?.toISOString?.() ?? null,
            updated_at: updated.updatedAt?.toISOString?.() ?? null,
        });
    });
    app.delete("/v1/destinations/:id", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const id = Number(req.params.id);
        const res = await db
            .delete(destinations)
            .where(and(eq(destinations.id, id), eq(destinations.accountId, ctx.account.id)))
            .returning({ id: destinations.id });
        if (!res.length) {
            await reply.code(404).send({ error: "not_found" });
            return;
        }
        await reply.code(204).send();
    });
    app.get("/v1/events", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const q = req.query;
        let page = Number(q.page ?? "1");
        if (!Number.isFinite(page) || page < 1)
            page = 1;
        const destId = q.destination_id != null && q.destination_id !== "" ? Number(q.destination_id) : null;
        if (destId != null && !Number.isFinite(destId)) {
            await reply.code(422).send({ error: "validation_error" });
            return;
        }
        const conditions = [
            eq(destinations.accountId, ctx.account.id),
            ...(destId != null ? [eq(webhookEvents.destinationId, destId)] : []),
        ];
        const evRows = await db
            .select({
            ev: webhookEvents,
            dest: destinations,
        })
            .from(webhookEvents)
            .innerJoin(destinations, eq(webhookEvents.destinationId, destinations.id))
            .where(and(...conditions))
            .orderBy(desc(webhookEvents.receivedAt))
            .limit(PAGE_SIZE)
            .offset((page - 1) * PAGE_SIZE);
        const eventIds = evRows.map((r) => r.ev.id);
        const latestByEvent = new Map();
        if (eventIds.length > 0) {
            const attemptRows = await db
                .select()
                .from(deliveryAttempts)
                .where(inArray(deliveryAttempts.webhookEventId, eventIds))
                .orderBy(desc(deliveryAttempts.requestedAt));
            for (const a of attemptRows) {
                if (!latestByEvent.has(a.webhookEventId))
                    latestByEvent.set(a.webhookEventId, a);
            }
        }
        await reply.send({
            page,
            page_size: PAGE_SIZE,
            events: evRows.map(({ ev, dest }) => ({
                id: ev.id,
                destination: {
                    id: dest.id,
                    name: dest.name,
                    public_key: dest.publicKey,
                },
                received_at: ev.receivedAt?.toISOString?.() ?? null,
                http_method: ev.httpMethod,
                content_type: ev.contentType,
                latest_attempt: latestByEvent.has(ev.id)
                    ? serializeAttempt(latestByEvent.get(ev.id))
                    : null,
            })),
        });
    });
    app.get("/v1/events/:id", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const id = Number(req.params.id);
        const [row] = await db
            .select({ ev: webhookEvents })
            .from(webhookEvents)
            .innerJoin(destinations, eq(webhookEvents.destinationId, destinations.id))
            .where(and(eq(webhookEvents.id, id), eq(destinations.accountId, ctx.account.id)))
            .limit(1);
        if (!row) {
            await reply.code(404).send({ error: "not_found" });
            return;
        }
        const ev = row.ev;
        await reply.send({
            id: ev.id,
            destination_id: ev.destinationId,
            received_at: ev.receivedAt?.toISOString?.() ?? null,
            http_method: ev.httpMethod,
            request_path: ev.requestPath,
            headers: ev.headers,
            raw_body: ev.rawBody,
            content_type: ev.contentType,
            source_ip: ev.sourceIp,
            created_at: ev.createdAt?.toISOString?.() ?? null,
            updated_at: ev.updatedAt?.toISOString?.() ?? null,
        });
    });
    app.post("/v1/events/:event_id/replay", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const eventId = Number(req.params.event_id);
        const [ev] = await db
            .select({ ev: webhookEvents, dest: destinations })
            .from(webhookEvents)
            .innerJoin(destinations, eq(webhookEvents.destinationId, destinations.id))
            .where(and(eq(webhookEvents.id, eventId), eq(destinations.accountId, ctx.account.id)))
            .limit(1);
        if (!ev) {
            await reply.code(404).send({ error: "not_found" });
            return;
        }
        const idem = req.headers["idempotency-key"]?.toString().trim();
        if (idem) {
            const [existing] = await db
                .select()
                .from(deliveryAttempts)
                .where(and(eq(deliveryAttempts.webhookEventId, ev.ev.id), eq(deliveryAttempts.idempotencyKey, idem)))
                .limit(1);
            if (existing) {
                await reply.code(202).send({
                    accepted: true,
                    attempt_id: existing.id,
                    idempotent: true,
                });
                return;
            }
        }
        const now = new Date();
        const [attempt] = await db
            .insert(deliveryAttempts)
            .values({
            webhookEventId: ev.ev.id,
            destinationId: ev.dest.id,
            kind: "replay",
            requestedAt: now,
            idempotencyKey: idem ?? null,
            createdAt: now,
            updatedAt: now,
        })
            .returning();
        await publishDeliveryAttempt(redis, attempt.webhookEventId, attempt);
        await replayQueue.add("replay", { deliveryAttemptId: attempt.id });
        await reply.code(202).send({ accepted: true, attempt_id: attempt.id });
    });
    app.get("/v1/delivery_attempts", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const eventIdRaw = req.query.event_id;
        const eventId = eventIdRaw != null && eventIdRaw !== "" ? Number(eventIdRaw) : null;
        if (eventId != null && !Number.isFinite(eventId)) {
            await reply.code(422).send({ error: "validation_error" });
            return;
        }
        const attempts = eventId != null
            ? await db
                .select({ a: deliveryAttempts })
                .from(deliveryAttempts)
                .innerJoin(webhookEvents, eq(deliveryAttempts.webhookEventId, webhookEvents.id))
                .innerJoin(destinations, eq(webhookEvents.destinationId, destinations.id))
                .where(and(eq(destinations.accountId, ctx.account.id), eq(deliveryAttempts.webhookEventId, eventId)))
                .orderBy(desc(deliveryAttempts.requestedAt))
                .limit(100)
            : await db
                .select({ a: deliveryAttempts })
                .from(deliveryAttempts)
                .innerJoin(webhookEvents, eq(deliveryAttempts.webhookEventId, webhookEvents.id))
                .innerJoin(destinations, eq(webhookEvents.destinationId, destinations.id))
                .where(eq(destinations.accountId, ctx.account.id))
                .orderBy(desc(deliveryAttempts.requestedAt))
                .limit(100);
        await reply.send({
            attempts: attempts.map((row) => serializeAttempt(row.a)),
        });
    });
    app.post("/v1/exports/logs", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const body = (req.body ?? {});
        const destinationIdRaw = body.destination_id;
        const receivedAtFromRaw = body.received_at_from;
        const receivedAtToRaw = body.received_at_to;
        const destinationId = destinationIdRaw == null || destinationIdRaw === ""
            ? null
            : typeof destinationIdRaw === "number"
                ? destinationIdRaw
                : Number(destinationIdRaw);
        if (destinationId != null && !Number.isFinite(destinationId)) {
            await reply.code(422).send({ error: "validation_error", details: { destination_id: ["invalid"] } });
            return;
        }
        const receivedAtFrom = typeof receivedAtFromRaw === "string" ? receivedAtFromRaw : null;
        const receivedAtTo = typeof receivedAtToRaw === "string" ? receivedAtToRaw : null;
        const job = await logExportQueue.add("export_logs", {
            accountId: ctx.account.id,
            requestedByUserId: ctx.user.id,
            destinationId,
            receivedAtFrom,
            receivedAtTo,
        }, {
            removeOnComplete: false,
            removeOnFail: false,
        });
        await reply.code(202).send({ export_id: job.id, status: "queued" });
    });
    app.get("/v1/exports/logs/:id", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const id = req.params.id;
        const job = await logExportQueue.getJob(id);
        if (!job) {
            await reply.code(404).send({ error: "not_found" });
            return;
        }
        const data = job.data;
        if (data.accountId !== ctx.account.id) {
            await reply.code(404).send({ error: "not_found" });
            return;
        }
        const state = await job.getState();
        const result = (job.returnvalue ?? null);
        await reply.send({
            export_id: job.id,
            status: state,
            result,
            failed_reason: job.failedReason ?? null,
        });
    });
    app.get("/v1/exports/logs/:id/download", async (req, reply) => {
        const ctx = await authenticate(req, reply, deps);
        if (!ctx)
            return;
        const id = req.params.id;
        const job = await logExportQueue.getJob(id);
        if (!job) {
            await reply.code(404).send({ error: "not_found" });
            return;
        }
        const data = job.data;
        if (data.accountId !== ctx.account.id) {
            await reply.code(404).send({ error: "not_found" });
            return;
        }
        const state = await job.getState();
        if (state !== "completed") {
            await reply.code(409).send({ error: "not_ready", status: state });
            return;
        }
        const result = job.returnvalue;
        if (!result?.filePath) {
            await reply.code(500).send({ error: "missing_artifact" });
            return;
        }
        const expiresAtMs = Date.parse(result.expiresAt);
        if (Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
            await reply.code(410).send({ error: "expired" });
            return;
        }
        const stream = fs.createReadStream(result.filePath);
        stream.on("error", async () => {
            if (!reply.sent)
                await reply.code(404).send({ error: "not_found" });
        });
        reply
            .header("Content-Type", "application/x-ndjson; charset=utf-8")
            .header("Content-Disposition", `attachment; filename="${result.fileName}"`);
        await reply.send(stream);
    });
}
