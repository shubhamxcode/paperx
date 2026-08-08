import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { instruments } from "@/db/schema";
import {
  MarketDataUnavailableError,
  UpstoxClient,
} from "@/lib/upstox/client";
import {
  marketDataCacheKey,
  withMarketDataCache,
} from "@/lib/upstox/cache";

const RANGE_CONFIG = {
  "1D": { days: 0, unit: "minutes", interval: 5, intraday: true },
  "1W": { days: 7, unit: "minutes", interval: 30, intraday: false },
  "1M": { days: 31, unit: "hours", interval: 1, intraday: false },
  "3M": { days: 93, unit: "days", interval: 1, intraday: false },
  "1Y": { days: 366, unit: "days", interval: 1, intraday: false },
  "5Y": { days: 366 * 5 + 2, unit: "weeks", interval: 1, intraday: false },
} as const;

const INTRADAY_INTERVALS = {
  "1m": { unit: "minutes", interval: 1 },
  "5m": { unit: "minutes", interval: 5 },
  "15m": { unit: "minutes", interval: 15 },
  "30m": { unit: "minutes", interval: 30 },
  "1h": { unit: "hours", interval: 1 },
} as const;

type RangeKey = keyof typeof RANGE_CONFIG;
type IntradayIntervalKey = keyof typeof INTRADAY_INTERVALS;

function isoDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function GET(request: NextRequest) {
  try {
    const instrumentKey = request.nextUrl.searchParams.get("instrumentKey")?.trim();
    const range = request.nextUrl.searchParams.get("range") as RangeKey | null;
    const requestedInterval = request.nextUrl.searchParams.get("interval") as IntradayIntervalKey | null;
    if (!instrumentKey || instrumentKey.length > 128 || !range || !(range in RANGE_CONFIG)) {
      return NextResponse.json({ error: "A valid instrumentKey and range are required" }, { status: 400 });
    }
    if (requestedInterval && !(requestedInterval in INTRADAY_INTERVALS)) {
      return NextResponse.json({ error: "Unsupported candle interval" }, { status: 400 });
    }

    const [instrument] = await db
      .select({ instrumentKey: instruments.instrumentKey })
      .from(instruments)
      .where(eq(instruments.instrumentKey, instrumentKey));
    if (!instrument) return NextResponse.json({ error: "Instrument not found" }, { status: 404 });

    const config = RANGE_CONFIG[range];
    const intradayInterval = requestedInterval
      ? INTRADAY_INTERVALS[requestedInterval]
      : INTRADAY_INTERVALS["5m"];
    const result = await withMarketDataCache(
      marketDataCacheKey(
        "candles",
        `${instrumentKey}:${range}:${
          config.intraday
            ? requestedInterval ?? "5m"
            : `${config.interval}-${config.unit}`
        }`
      ),
      config.intraday ? 15 : 300,
      () => {
        const client = new UpstoxClient();
        return config.intraday
          ? client.getIntradayCandles({
              instrumentKey,
              unit: intradayInterval.unit,
              interval: intradayInterval.interval,
            })
          : client.getHistoricalCandles({
              instrumentKey,
              unit: config.unit,
              interval: config.interval,
              toDate: isoDate(new Date()),
              fromDate: isoDate(new Date(Date.now() - config.days * 86_400_000)),
            });
      }
    );

    const candles = (result.data?.candles ?? [])
      .map(([timestamp, open, high, low, close, volume]) => ({
        time: Math.floor(new Date(timestamp).getTime() / 1000),
        open,
        high,
        low,
        close,
        volume,
      }))
      .filter((candle) => Number.isFinite(candle.time) && candle.time > 0)
      .sort((a, b) => a.time - b.time);

    return NextResponse.json({
      range,
      interval: config.intraday
        ? `${intradayInterval.interval} ${intradayInterval.unit}`
        : `${config.interval} ${config.unit}`,
      candles,
    });
  } catch (error: unknown) {
    if (error instanceof MarketDataUnavailableError) {
      return NextResponse.json(
        { error: error.message, marketDataUnavailable: true },
        { status: 503 }
      );
    }
    console.error("Error loading candles:", error);
    return NextResponse.json({ error: "Failed to load chart data" }, { status: 500 });
  }
}
