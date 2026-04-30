import { and, asc, desc, eq, gte, inArray, lt, lte, or } from "drizzle-orm";
import { deliveryAttempts, destinations, webhookEvents } from "../db/schema.js";
export async function fetchLogExportPage(db, query) {
    const eventRows = await fetchEventRows(db, query);
    if (eventRows.length === 0)
        return { rows: [], nextCursor: null };
    const attemptsByEvent = await fetchAttemptsByEventId(db, eventRows.map((row) => row.event.id));
    const rows = eventRows.map((row) => ({
        ...row,
        attempts: attemptsByEvent.get(row.event.id) ?? [],
    }));
    const last = eventRows[eventRows.length - 1].event;
    return {
        rows,
        nextCursor: {
            receivedAt: last.receivedAt,
            id: last.id,
        },
    };
}
async function fetchEventRows(db, query) {
    const { filters, cursor, limit } = query;
    const conditions = [eq(destinations.accountId, filters.accountId)];
    if (filters.destinationId != null)
        conditions.push(eq(webhookEvents.destinationId, filters.destinationId));
    if (filters.receivedAtFrom)
        conditions.push(gte(webhookEvents.receivedAt, filters.receivedAtFrom));
    if (filters.receivedAtTo)
        conditions.push(lte(webhookEvents.receivedAt, filters.receivedAtTo));
    if (cursor) {
        const cursorCond = or(lt(webhookEvents.receivedAt, cursor.receivedAt), and(eq(webhookEvents.receivedAt, cursor.receivedAt), lt(webhookEvents.id, cursor.id)));
        if (cursorCond)
            conditions.push(cursorCond);
    }
    return await db
        .select({ event: webhookEvents, destination: destinations })
        .from(webhookEvents)
        .innerJoin(destinations, eq(webhookEvents.destinationId, destinations.id))
        .where(and(...conditions))
        .orderBy(desc(webhookEvents.receivedAt), desc(webhookEvents.id))
        .limit(limit);
}
async function fetchAttemptsByEventId(db, eventIds) {
    if (eventIds.length === 0)
        return new Map();
    const attempts = await db
        .select()
        .from(deliveryAttempts)
        .where(inArray(deliveryAttempts.webhookEventId, eventIds))
        .orderBy(asc(deliveryAttempts.requestedAt));
    const attemptsByEvent = new Map();
    for (const attempt of attempts) {
        const list = attemptsByEvent.get(attempt.webhookEventId) ?? [];
        list.push(attempt);
        attemptsByEvent.set(attempt.webhookEventId, list);
    }
    return attemptsByEvent;
}
