import { Router } from "express";
import type { Pool } from "pg";

export function webhookRouter(pool: Pool) {
  const router = Router();

  router.post("/webhook/:id", async (req, res, next) => {
    const { id } = req.params;
    try {
      const destinationResult = await pool.query(
        "select id, public_key from destinations where public_key = $1 limit 1",
        [id]
      );

      if (destinationResult.rowCount === 0) {
        return res.status(404).json({ error: "destination_not_found" });
      }

      const destination = destinationResult.rows[0] as { id: number; public_key: string };
      const receivedAt = new Date();
      const contentType = req.get("content-type") ?? null;

      const headers: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (v == null) continue;
        headers[k] = v;
      }

      const rawBody =
        typeof req.body === "string"
          ? req.body
          : req.body == null
            ? ""
            : JSON.stringify(req.body);

      const idempotencyKey = req.get("idempotency-key") ?? null;

      if (idempotencyKey) {
        const existing = await pool.query(
          "select id from webhook_events where destination_id = $1 and idempotency_key = $2 limit 1",
          [destination.id, idempotencyKey]
        );
        if ((existing.rowCount ?? 0) > 0) {
          return res.status(202).json({
            accepted: true,
            idempotent: true,
            destination_key: destination.public_key,
            event_id: existing.rows[0].id,
            received_at: receivedAt.toISOString(),
          });
        }
      }

      const insertResult = await pool.query(
        `
        insert into webhook_events
          (destination_id, received_at, http_method, request_path, headers, raw_body, content_type, source_ip, idempotency_key, created_at, updated_at)
        values
          ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, now(), now())
        returning id
      `,
        [
          destination.id,
          receivedAt.toISOString(),
          req.method,
          req.originalUrl,
          JSON.stringify(headers),
          rawBody,
          contentType,
          req.ip ?? null,
          idempotencyKey,
        ]
      );

      return res.status(202).json({
        accepted: true,
        destination_key: destination.public_key,
        event_id: insertResult.rows[0].id,
        received_at: receivedAt.toISOString(),
      });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

