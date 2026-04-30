"use client";

import { io, type Socket } from "socket.io-client";

/** Browser connects to the public core API URL (same as NEXT_PUBLIC_API_BASE_URL), not the Next /api/core proxy. */
export function subscribeToDeliveryAttempts(
  apiBaseUrl: string,
  eventId: number,
  onDeliveryAttempt: (data: unknown) => void
): () => void {
  const socket: Socket = io(apiBaseUrl, {
    path: "/socket.io/",
    transports: ["websocket", "polling"],
  });

  socket.emit("subscribe", { event_id: eventId });

  socket.on("delivery_attempt", (data: unknown) => {
    onDeliveryAttempt(data);
  });

  return () => {
    socket.disconnect();
  };
}
