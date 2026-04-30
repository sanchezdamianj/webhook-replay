import type { Redis } from "ioredis";
import type { DeliveryAttemptRow } from "../serialize.js";
export declare function publishDeliveryAttempt(redis: Redis, webhookEventId: number, attempt: DeliveryAttemptRow): Promise<void>;
