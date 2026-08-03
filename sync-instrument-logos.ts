/** Backfill Brandfetch logo URLs for existing equity instruments. */
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const [{ drizzle }, { Pool }, schema, { sql, count, isNotNull }] = await Promise.all([
    import("drizzle-orm/node-postgres"),
    import("pg"),
    import("./src/db/schema"),
    import("drizzle-orm"),
  ]);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const clientId = process.env.BRANDFETCH_CLIENT_ID?.trim();
  const baseUrl = (process.env.BRANDFETCH_LOGO_BASE_URL?.trim() || "https://cdn.brandfetch.io").replace(/\/$/, "");
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!clientId || !/^[A-Za-z0-9_-]{6,128}$/.test(clientId)) throw new Error("BRANDFETCH_CLIENT_ID is missing or invalid");
  if (new URL(baseUrl).protocol !== "https:") throw new Error("BRANDFETCH_LOGO_BASE_URL must use HTTPS");

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  const { instruments } = schema;

  try {
    await db.execute(sql`
      update ${instruments}
      set
        "logoUrl" = ${baseUrl} || '/isin/' || upper(trim(${instruments.isin})) || '?c=' || ${clientId},
        "logoSource" = 'BRANDFETCH',
        "logoUpdatedAt" = now()
      where ${instruments.isin} ~ '^[A-Za-z]{2}[A-Za-z0-9]{9}[0-9]$'
    `);
    const [{ value: updated }] = await db.select({ value: count() }).from(instruments).where(isNotNull(instruments.logoUrl));
    console.log(`Stored Brandfetch logo metadata for ${updated} instruments.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Logo synchronization failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
