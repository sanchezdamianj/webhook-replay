import "dotenv/config";
import { z } from "zod";
const envSchema = z.object({
    NODE_ENV: z.string().optional(),
    PORT: z.coerce.number().int().positive().default(3000),
    JWT_SECRET: z.string().min(1).default("dev_secret_change_me"),
    POSTGRES_HOST: z.string().default("localhost"),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
    POSTGRES_USER: z.string().default("webhook_replay"),
    POSTGRES_PASSWORD: z.string().default("webhook_replay"),
    POSTGRES_DB: z.string().default("webhook_replay_development"),
    DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().default("redis://localhost:6379/0"),
    ALLOWED_ORIGINS: z.string().optional(),
    REPLAY_MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
    REPLAY_BASE_BACKOFF_SECONDS: z.coerce.number().positive().default(1),
    REPLAY_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(16_384),
});
const parsed = envSchema.parse(process.env);
export const env = parsed;
export function databaseUrl() {
    if (parsed.DATABASE_URL)
        return parsed.DATABASE_URL;
    const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB } = parsed;
    return `postgresql://${encodeURIComponent(POSTGRES_USER)}:${encodeURIComponent(POSTGRES_PASSWORD)}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;
}
export function corsOrigin() {
    const raw = parsed.ALLOWED_ORIGINS;
    if (!raw || raw === "*")
        return true;
    return raw.split(",").map((s) => s.trim());
}
