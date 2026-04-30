import { logger } from "../lib/logger.js";
export const errorHandler = (err, _req, res, _next) => {
    const anyErr = err;
    if (anyErr?.type === "entity.too.large" || anyErr?.status === 413) {
        return res.status(413).json({ error: "payload_too_large" });
    }
    logger.error({ err }, "gateway_error");
    return res.status(500).json({ error: "internal_error" });
};
