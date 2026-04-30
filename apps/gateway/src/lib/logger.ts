import pino from "pino";
import pinoHttp from "pino-http";
import type { IncomingMessage } from "node:http";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

export const httpLogger = pinoHttp.default({
  logger,
  customProps: (req: IncomingMessage) => ({
    request_id: req.headers["x-request-id"],
  }),
});

