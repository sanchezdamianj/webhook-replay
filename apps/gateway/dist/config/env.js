import { z } from "zod";
const envSchema = z.object({
    NODE_ENV: z.string().optional(),
    PORT: z.coerce.number().int().positive().default(3001),
    MAX_BODY_BYTES: z.coerce.number().int().positive().default(1_048_576),
    POSTGRES_HOST: z.string().default("localhost"),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
    POSTGRES_USER: z.string().default("webhook_replay"),
    POSTGRES_PASSWORD: z.string().default("webhook_replay"),
    POSTGRES_DB: z.string().default("webhook_replay_development"),
});
export const env = envSchema.parse(process.env);
