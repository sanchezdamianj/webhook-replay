import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { databaseUrl, env } from "./config/env.js";
import { createDb } from "./db/client.js";
import { processLogExport } from "./exports/processLogExport.js";
import { logExportQueue, logExportQueueConnection } from "./jobs/logExportQueue.js";
import { replayQueue } from "./jobs/replayQueue.js";
import { processDeliveryAttempt } from "./replay/processDeliveryAttempt.js";
async function main() {
    const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const redisPublisher = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const { pool, db } = createDb(databaseUrl());
    const replayWorker = new Worker("replay", async (job) => {
        await processDeliveryAttempt({ db, redis: redisPublisher, replayQueue, env }, job.data.deliveryAttemptId);
    }, { connection });
    replayWorker.on("failed", (job, err) => {
        console.error("replay_job_failed", job?.id, err);
    });
    const exportWorker = new Worker("log-exports", async (job) => {
        const id = job.id?.toString() ?? "unknown";
        return await processLogExport({ db, env }, id, job.data);
    }, { connection });
    exportWorker.on("failed", (job, err) => {
        console.error("log_export_job_failed", job?.id, err);
    });
    console.info("workers_started");
    async function shutdown(signal) {
        console.info({ signal }, "worker_shutdown_start");
        await replayWorker.close();
        await exportWorker.close();
        await redisPublisher.quit();
        await connection.quit();
        await replayQueue.close();
        await logExportQueue.close();
        await logExportQueueConnection.quit();
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
