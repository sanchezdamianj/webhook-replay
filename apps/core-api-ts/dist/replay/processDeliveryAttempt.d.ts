import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Env } from "../config/env.js";
import type { Db } from "../db/client.js";
export type ReplayProcessDeps = {
    db: Db;
    redis: Redis;
    replayQueue: Queue<{
        deliveryAttemptId: number;
    }, void, string>;
    env: Env;
};
export declare function processDeliveryAttempt(deps: ReplayProcessDeps, deliveryAttemptId: number): Promise<void>;
