import { db } from "./index";
import { instruments } from "./schema";
import { and, ilike, inArray, or, sql } from "drizzle-orm";

export type InstrumentSearchResult = {
    instrumentKey: string;
    tradingSymbol: string;
    name: string | null;
    exchange: string;
    segment: string;
};

/**
 * Search the mirrored Upstox instrument master for stocks/indices.
 * Matches a trading-symbol prefix (e.g. "rel" -> RELIANCE) or a name substring,
 * and ranks prefix matches first.
 */
export async function searchInstruments(
    query: string,
    limit = 20
): Promise<InstrumentSearchResult[]> {
    const q = query.trim();
    if (!q) return [];

    const prefix = `${q}%`;
    const contains = `%${q}%`;

    return db
        .select({
            instrumentKey: instruments.instrumentKey,
            tradingSymbol: instruments.tradingSymbol,
            name: instruments.name,
            exchange: instruments.exchange,
            segment: instruments.segment,
        })
        .from(instruments)
        .where(
            and(
                inArray(instruments.segment, ["NSE_EQ", "BSE_EQ", "NSE_INDEX", "BSE_INDEX"]),
                or(
                    ilike(instruments.tradingSymbol, prefix),
                    ilike(instruments.name, contains)
                )
            )
        )
        // symbol prefix matches first, then NSE before BSE, then alphabetical
        .orderBy(
            sql`CASE WHEN ${instruments.tradingSymbol} ILIKE ${prefix} THEN 0 ELSE 1 END`,
            sql`CASE WHEN ${instruments.segment} = 'NSE_EQ' THEN 0 WHEN ${instruments.segment} = 'NSE_INDEX' THEN 1 ELSE 2 END`,
            instruments.tradingSymbol
        )
        .limit(limit);
}
