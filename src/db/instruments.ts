import { db } from "./index";
import { instruments } from "./schema";
import { and, ilike, inArray, or, sql } from "drizzle-orm";

export type InstrumentSearchResult = {
    instrumentKey: string;
    tradingSymbol: string;
    name: string | null;
    exchange: string;
    segment: string;
    logoUrl: string | null;
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
    const compactQuery = q.toLowerCase().replace(/[^a-z0-9]/g, "").replaceAll("silver", "silv");
    const compactContains = `%${compactQuery}%`;

    return db
        .select({
            instrumentKey: instruments.instrumentKey,
            tradingSymbol: instruments.tradingSymbol,
            name: sql<string | null>`coalesce(${instruments.shortName}, ${instruments.name})`,
            exchange: instruments.exchange,
            segment: instruments.segment,
            logoUrl: instruments.logoUrl,
        })
        .from(instruments)
        .where(
            and(
                inArray(instruments.segment, ["NSE_EQ", "BSE_EQ", "NSE_INDEX", "BSE_INDEX"]),
                or(
                    ilike(instruments.tradingSymbol, prefix),
                    ilike(instruments.name, contains),
                    ilike(instruments.shortName, contains),
                    sql`regexp_replace(lower(${instruments.tradingSymbol}), '[^a-z0-9]', '', 'g') LIKE ${compactContains}`,
                    sql`regexp_replace(lower(coalesce(${instruments.shortName}, '')), '[^a-z0-9]', '', 'g') LIKE ${compactContains}`,
                    sql`regexp_replace(lower(coalesce(${instruments.name}, '')), '[^a-z0-9]', '', 'g') LIKE ${compactContains}`
                )
            )
        )
        // symbol prefix matches first, then NSE before BSE, then alphabetical
        .orderBy(
            sql`CASE WHEN ${instruments.tradingSymbol} ILIKE ${prefix} THEN 0 ELSE 1 END`,
            sql`CASE WHEN ${instruments.shortName} ILIKE ${prefix} THEN 0 WHEN ${instruments.name} ILIKE ${prefix} THEN 1 ELSE 2 END`,
            sql`CASE WHEN ${instruments.segment} = 'NSE_EQ' THEN 0 WHEN ${instruments.segment} = 'NSE_INDEX' THEN 1 ELSE 2 END`,
            instruments.tradingSymbol
        )
        .limit(limit);
}
