import pino from "pino";
import pinoHttp from "pino-http";
export const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
});
export const httpLogger = pinoHttp.default({
    logger,
    customProps: (req) => ({
        request_id: req.headers["x-request-id"],
    }),
});
