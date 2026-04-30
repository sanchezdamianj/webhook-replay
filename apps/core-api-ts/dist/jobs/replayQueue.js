import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
export const replayQueueConnection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
export const replayQueue = new Queue("replay", {
    connection: replayQueueConnection,
});
