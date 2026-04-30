import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";
import type { Db } from "../db/client.js";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
export type V1Deps = {
    db: Db;
    env: Env;
    replayQueue: Queue<{
        deliveryAttemptId: number;
    }, void, string>;
    redis: Redis;
};
export declare function registerV1Routes(app: FastifyInstance, deps: V1Deps): Promise<void>;
