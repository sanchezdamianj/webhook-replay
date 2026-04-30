import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(connectionString: string): { pool: pg.Pool; db: Db } {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { pool, db };
}
