import { NextRequest, NextResponse } from "next/server";
import {
    MarketDataUnavailableError,
    UpstoxClient,
} from "@/lib/upstox/client";
import {
    marketDataCacheKey,
    withMarketDataCache,
} from "@/lib/upstox/cache";

const MAX_INSTRUMENTS = 50;
const MAX_INSTRUMENT_KEY_LENGTH = 128;

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const instrumentKeys = searchParams.getAll("instrument_key");

        if (!instrumentKeys || instrumentKeys.length === 0) {
            return NextResponse.json(
                { error: "No instrument keys provided" },
                { status: 400 }
            );
        }

        if (
            instrumentKeys.length > MAX_INSTRUMENTS ||
            instrumentKeys.some((key) => !key || key.length > MAX_INSTRUMENT_KEY_LENGTH)
        ) {
            return NextResponse.json(
                { error: `Provide at most ${MAX_INSTRUMENTS} valid instrument keys` },
                { status: 400 }
            );
        }

        const normalizedKeys = [...new Set(instrumentKeys)].sort();
        const quotes = await withMarketDataCache(
            marketDataCacheKey("quotes", normalizedKeys.join(",")),
            3,
            () => new UpstoxClient().getMarketQuotes(normalizedKeys)
        );

        return NextResponse.json(quotes);
    } catch (error: unknown) {
        console.error(
            "Error fetching market quotes:",
            error instanceof Error ? error.message : "Unknown error"
        );
        if (error instanceof MarketDataUnavailableError) {
            return NextResponse.json(
                { error: error.message, marketDataUnavailable: true },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { error: "Failed to fetch market quotes" },
            { status: 500 }
        );
    }
}
