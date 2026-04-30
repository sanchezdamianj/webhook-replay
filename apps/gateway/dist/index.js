import "dotenv/config";
import express from "express";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { httpLogger, logger } from "./lib/logger.js";
import { bodyParsers } from "./middleware/bodyParsers.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { webhookRouter } from "./routes/webhook.js";
const app = express();
app.disable("x-powered-by");
app.use(httpLogger);
for (const mw of bodyParsers(env.MAX_BODY_BYTES))
    app.use(mw);
app.use(healthRouter);
app.use(webhookRouter(pool));
app.use(errorHandler);
const server = app.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT }, "gateway_listening");
});
function shutdown(signal) {
    logger.info({ signal }, "gateway_shutdown_start");
    server.close(() => {
        pool.end().catch(() => { });
        logger.info("gateway_shutdown_done");
        process.exit(0);
    });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
