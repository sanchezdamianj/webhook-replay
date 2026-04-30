import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
export function createDb(connectionString) {
    const pool = new pg.Pool({ connectionString });
    const db = drizzle(pool, { schema });
    return { pool, db };
}
