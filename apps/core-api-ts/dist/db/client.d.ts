import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
export type Db = ReturnType<typeof drizzle<typeof schema>>;
export declare function createDb(connectionString: string): {
    pool: pg.Pool;
    db: Db;
};
