import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
export const logExportQueueConnection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
export const logExportQueue = new Queue("log-exports", {
    connection: logExportQueueConnection,
});
