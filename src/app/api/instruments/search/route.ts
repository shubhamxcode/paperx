import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { sql } from "drizzle-orm";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { searchInstruments } from "@/db/instruments";
import { instruments } from "@/db/schema";
import { UpstoxAuthError, UpstoxClient } from "@/lib/upstox/client";
import { instrumentDisplayName } from "@/lib/instruments/display-name";

const MAX_QUERY_LENGTH = 80;

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const q = req.nextUrl.searchParams.get("q") ?? "";
        if (q.trim().length < 1) {
            return NextResponse.json({ results: [] });
        }

        if (q.length > MAX_QUERY_LENGTH) {
            return NextResponse.json(
                { error: `Search query must be at most ${MAX_QUERY_LENGTH} characters` },
                { status: 400 }
            );
        }

        // Keep the local mirror current for the instruments the user discovers.
        // Search remains usable from the local DB when Upstox is disconnected.
        try {
            if (q.trim().length < 2 || q.trim().length > 50) {
                return NextResponse.json({ results: await searchInstruments(q) });
            }
            const remote = await new UpstoxClient(session.user.id).searchInstruments(q.trim());
            const rows = (remote.data ?? [])
                .filter((item) => ["NSE_EQ", "BSE_EQ", "NSE_INDEX", "BSE_INDEX"].includes(item.segment))
                .map((item) => ({
                    instrumentKey: item.instrument_key,
                    tradingSymbol: item.trading_symbol,
                    name: item.name ?? null,
                    shortName: instrumentDisplayName({
                        isin: item.isin,
                        shortName: item.short_name,
                        name: item.name,
                        tradingSymbol: item.trading_symbol,
                    }),
                    exchange: item.exchange,
                    segment: item.segment,
                    instrumentType: item.instrument_type ?? null,
                    isin: item.isin ?? null,
                    exchangeToken: item.exchange_token ?? null,
                    lotSize: item.lot_size ?? null,
                    tickSize: item.tick_size ?? null,
                    updatedAt: new Date(),
                }));

            if (rows.length) {
                await db.insert(instruments).values(rows).onConflictDoUpdate({
                    target: instruments.instrumentKey,
                    set: {
                        tradingSymbol: sql`excluded."tradingSymbol"`,
                        name: sql`excluded."name"`,
                        shortName: sql`excluded."shortName"`,
                        exchange: sql`excluded."exchange"`,
                        segment: sql`excluded."segment"`,
                        instrumentType: sql`excluded."instrumentType"`,
                        isin: sql`excluded."isin"`,
                        exchangeToken: sql`excluded."exchangeToken"`,
                        lotSize: sql`excluded."lotSize"`,
                        tickSize: sql`excluded."tickSize"`,
                        updatedAt: sql`excluded."updatedAt"`,
                    },
                });
            }
        } catch (error) {
            if (!(error instanceof UpstoxAuthError)) {
                console.warn("Upstox instrument search unavailable; using local mirror", error);
            }
        }

        const results = await searchInstruments(q);
        return NextResponse.json({ results });
    } catch (error: unknown) {
        console.error("Error searching instruments:", error);
        return NextResponse.json(
            { error: "Failed to search instruments" },
            { status: 500 }
        );
    }
}
