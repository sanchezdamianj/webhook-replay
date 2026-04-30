import cors from "@fastify/cors";
import Fastify from "fastify";
import { Redis } from "ioredis";
import { Server } from "socket.io";
import { corsOrigin, databaseUrl, env } from "./config/env.js";
import { createDb } from "./db/client.js";
import { registerV1Routes } from "./http/v1Routes.js";
import { replayQueue } from "./jobs/replayQueue.js";

async function main() {
  const redisPublisher = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const redisSubscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const { pool, db } = createDb(databaseUrl());

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: corsOrigin(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  });

  await registerV1Routes(app, {
    db,
    env,
    replayQueue,
    redis: redisPublisher,
  });

  await app.ready();

  const io = new Server(app.server, {
    path: "/socket.io/",
    cors: {
      origin: corsOrigin(),
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("subscribe", (payload: { event_id?: unknown }) => {
      const raw = payload?.event_id;
      const eventId = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(eventId)) return;
      socket.join(`attempts:event:${eventId}`);
    });
  });

  redisSubscriber.on("message", (_channel, msg) => {
    try {
      const parsed = JSON.parse(msg) as { room?: string; event?: string; data?: unknown };
      if (parsed.room && parsed.event) {
        io.to(parsed.room).emit(parsed.event, parsed.data);
      }
    } catch {
      /* ignore */
    }
  });

  await redisSubscriber.subscribe("wr:attempts");

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info({ port: env.PORT }, "core_api_ts_listening");

  async function shutdown(signal: string) {
    app.log.info({ signal }, "shutdown_start");
    await app.close();
    io.close();
    await redisSubscriber.quit();
    await redisPublisher.quit();
    await replayQueue.close();
    await pool.end().catch(() => {});
    app.log.info("shutdown_done");
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
