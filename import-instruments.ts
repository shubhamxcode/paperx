/**
 * Import the Upstox instrument master file (public/complete.json) into the DB.
 *
 * Usage:  npx tsx import-instruments.ts
 *
 * Re-run any time you download a fresh complete.json — the table is rebuilt
 * from scratch so delisted/expired instruments are removed.
 */
import * as fs from "fs";
import * as path from "path";
import { instrumentDisplayName } from "./src/lib/instruments/display-name";

// --- Load .env FIRST (before importing the DB client) ---
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf8")
        .split("\n")
        .forEach((line) => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, "");
                process.env[key] = value;
            }
        });
} else {
    console.warn(".env not found at", envPath, "- relying on existing process.env");
}

// Which segments to import. The full file has 140k+ rows, but F&O / commodity
// contracts expire and change daily. For paper-trading equities we keep stocks
// + indices. Add "NSE_FO", "MCX_FO" etc. here if you ever need derivatives.
const SEGMENTS = new Set(["NSE_EQ", "BSE_EQ", "NSE_INDEX", "BSE_INDEX"]);

const FILE = path.resolve(process.cwd(), "data/complete.json");
const CHUNK_SIZE = 1000;

type RawInstrument = {
    instrument_key: string;
    trading_symbol: string;
    name?: string;
    short_name?: string;
    exchange: string;
    segment: string;
    instrument_type?: string;
    isin?: string;
    exchange_token?: string;
    lot_size?: number;
    tick_size?: number;
    expiry?: number; // epoch ms
    strike_price?: number;
    underlying_symbol?: string;
    asset_symbol?: string;
    weekly?: boolean;
};

async function main() {
    if (!fs.existsSync(FILE)) {
        console.error("File not found:", FILE);
        process.exit(1);
    }

    // Create the script's own pool so Next.js-only server guards stay intact.
    const [{ drizzle }, { Pool }, schema] = await Promise.all([
        import("drizzle-orm/node-postgres"),
        import("pg"),
        import("./src/db/schema"),
    ]);
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const brandfetchClientId = process.env.BRANDFETCH_CLIENT_ID?.trim();
    const brandfetchBaseUrl = (process.env.BRANDFETCH_LOGO_BASE_URL?.trim() || "https://cdn.brandfetch.io").replace(/\/$/, "");
    if (!databaseUrl) throw new Error("DATABASE_URL is required");
    if (!brandfetchClientId || !/^[A-Za-z0-9_-]{6,128}$/.test(brandfetchClientId)) throw new Error("BRANDFETCH_CLIENT_ID is missing or invalid");
    const pool = new Pool({ connectionString: databaseUrl });
    const db = drizzle(pool, { schema });
    const { instruments } = schema;
    const brandfetchLogoUrl = (isin?: string) => {
        const normalized = isin?.trim().toUpperCase();
        if (!normalized || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(normalized)) return null;
        const url = new URL(`/isin/${encodeURIComponent(normalized)}`, brandfetchBaseUrl);
        url.searchParams.set("c", brandfetchClientId);
        return url.toString();
    };

    console.log("Reading", FILE, "...");
    const raw: RawInstrument[] = JSON.parse(fs.readFileSync(FILE, "utf8"));
    console.log("Total rows in file:", raw.length);

    const rows = raw
        .filter((r) => SEGMENTS.has(r.segment))
        .map((r) => {
          const logoUrl = brandfetchLogoUrl(r.isin);
          return ({
            instrumentKey: r.instrument_key,
            tradingSymbol: r.trading_symbol,
            name: r.name ?? null,
            shortName: instrumentDisplayName({
              isin: r.isin,
              shortName: r.short_name,
              name: r.name,
              tradingSymbol: r.trading_symbol,
            }),
            exchange: r.exchange,
            segment: r.segment,
            instrumentType: r.instrument_type ?? null,
            isin: r.isin ?? null,
            logoUrl,
            logoSource: logoUrl ? "BRANDFETCH" as const : null,
            logoUpdatedAt: logoUrl ? new Date() : null,
            exchangeToken: r.exchange_token ?? null,
            lotSize: r.lot_size ?? null,
            tickSize: r.tick_size ?? null,
            expiry: r.expiry ? new Date(r.expiry) : null,
            strikePrice: r.strike_price ?? null,
            underlyingSymbol: r.underlying_symbol ?? null,
            assetSymbol: r.asset_symbol ?? null,
            weekly: r.weekly ?? null,
            updatedAt: new Date(),
          });
        });

    console.log("Rows to import (after segment filter):", rows.length);

    // Rebuild from scratch so stale instruments are dropped.
    console.log("Clearing existing instruments...");
    await db.delete(instruments);

    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        await db.insert(instruments).values(chunk);
        inserted += chunk.length;
        process.stdout.write(`\rInserted ${inserted}/${rows.length}`);
    }

    console.log("\nDone. Imported", inserted, "instruments.");
    await pool.end();
    process.exit(0);
}

main().catch((err) => {
    console.error("\nImport failed:", err);
    process.exit(1);
});
