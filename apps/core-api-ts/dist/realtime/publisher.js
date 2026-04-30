import { serializeAttempt } from "../serialize.js";
const CHANNEL = "wr:attempts";
export async function publishDeliveryAttempt(redis, webhookEventId, attempt) {
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
