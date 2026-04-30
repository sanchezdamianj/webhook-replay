import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

export type LogExportJobData = {
  accountId: number;
  requestedByUserId: number;
  destinationId?: number | null;
  receivedAtFrom?: string | null; // ISO
  receivedAtTo?: string | null; // ISO
};

export type LogExportJobResult = {
  format: "jsonl";
  filePath: string;
  fileName: string;
  bytes: number;
  createdAt: string; // ISO
  expiresAt: string; // ISO
};

export const logExportQueueConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const logExportQueue = new Queue<LogExportJobData, LogExportJobResult>("log-exports", {
  connection: logExportQueueConnection,
});

