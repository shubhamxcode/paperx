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

// --- Load .env FIRST (same pattern as check-upstox.ts) ---
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

const FILE = path.resolve(process.cwd(), "public/complete.json");
const CHUNK_SIZE = 1000;

type RawInstrument = {
    instrument_key: string;
    trading_symbol: string;
    name?: string;
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

    // Dynamic import so .env is loaded before the DB pool is created.
    const { db } = await import("./src/db");
    const { instruments } = await import("./src/db/schema");

    console.log("Reading", FILE, "...");
    const raw: RawInstrument[] = JSON.parse(fs.readFileSync(FILE, "utf8"));
    console.log("Total rows in file:", raw.length);

    const rows = raw
        .filter((r) => SEGMENTS.has(r.segment))
        .map((r) => ({
            instrumentKey: r.instrument_key,
            tradingSymbol: r.trading_symbol,
            name: r.name ?? null,
            exchange: r.exchange,
            segment: r.segment,
            instrumentType: r.instrument_type ?? null,
            isin: r.isin ?? null,
            exchangeToken: r.exchange_token ?? null,
            lotSize: r.lot_size ?? null,
            tickSize: r.tick_size ?? null,
            expiry: r.expiry ? new Date(r.expiry) : null,
            strikePrice: r.strike_price ?? null,
            underlyingSymbol: r.underlying_symbol ?? null,
            assetSymbol: r.asset_symbol ?? null,
            weekly: r.weekly ?? null,
            updatedAt: new Date(),
        }));

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
    process.exit(0);
}

main().catch((err) => {
    console.error("\nImport failed:", err);
    process.exit(1);
});
