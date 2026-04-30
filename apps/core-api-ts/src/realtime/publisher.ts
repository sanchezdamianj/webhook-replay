import type { Redis } from "ioredis";
import type { DeliveryAttemptRow } from "../serialize.js";
import { serializeAttempt } from "../serialize.js";

const CHANNEL = "wr:attempts";

export async function publishDeliveryAttempt(
  redis: Redis,
  webhookEventId: number,
  attempt: DeliveryAttemptRow
): Promise<void> {
  const payload = {
    room: `attempts:event:${webhookEventId}`,
    event: "delivery_attempt",
    data: {
      type: "delivery_attempt",
      attempt: serializeAttempt(attempt),
    },
  };
  await redis.publish(CHANNEL, JSON.stringify(payload));
}
