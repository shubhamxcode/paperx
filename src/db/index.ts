import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { serverEnv } from "@/lib/env/server";

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: serverEnv.databaseUrl,
});

// Create Drizzle instance
export const db = drizzle(pool, { schema });
