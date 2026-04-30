import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { databaseUrl, env } from "./config/env.js";
import { createDb } from "./db/client.js";
import { replayQueue } from "./jobs/replayQueue.js";
import { processDeliveryAttempt } from "./replay/processDeliveryAttempt.js";
async function main() {
    const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const redisPublisher = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const { pool, db } = createDb(databaseUrl());
    const worker = new Worker("replay", async (job) => {
        await processDeliveryAttempt({ db, redis: redisPublisher, replayQueue, env }, job.data.deliveryAttemptId);
    }, { connection });
    worker.on("failed", (job, err) => {
        console.error("replay_job_failed", job?.id, err);
    });
    console.info("replay_worker_started");
    async function shutdown(signal) {
        console.info({ signal }, "worker_shutdown_start");
        await worker.close();
        await redisPublisher.quit();
        await connection.quit();
        await replayQueue.close();
        await pool.end().catch(() => { });
        console.info("worker_shutdown_done");
        process.exit(0);
    }
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
