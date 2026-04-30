import { Queue } from "bullmq";
import { Redis } from "ioredis";
export declare const replayQueueConnection: Redis;
export declare const replayQueue: Queue<{
    deliveryAttemptId: number;
}, any, string, {
    deliveryAttemptId: number;
}, any, string>;
