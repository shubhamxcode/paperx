import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { instruments } from "@/db/schema";
import { UpstoxClient } from "@/lib/upstox/client";
import type { TutorRequest } from "@/lib/ai/schemas";
import { prepareCandlesForAi } from "@/lib/ai/candle-context";

const RANGE_CONFIG = {
  "1D": { days: 0, unit: "minutes", interval: 5, intraday: true },
  "1W": { days: 7, unit: "minutes", interval: 30, intraday: false },
  "1M": { days: 31, unit: "hours", interval: 1, intraday: false },
  "3M": { days: 93, unit: "days", interval: 1, intraday: false },
  "1Y": { days: 366, unit: "days", interval: 1, intraday: false },
  "5Y": { days: 1828, unit: "weeks", interval: 1, intraday: false },
} as const;

const INTRADAY = {
  "1m": { unit: "minutes", interval: 1 },
  "5m": { unit: "minutes", interval: 5 },
  "15m": { unit: "minutes", interval: 15 },
  "30m": { unit: "minutes", interval: 30 },
  "1h": { unit: "hours", interval: 1 },
} as const;

function isoDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function buildTutorContext(userId: string, request: TutorRequest) {
  const [instrument] = await db.select().from(instruments).where(eq(instruments.instrumentKey, request.instrumentKey));
  if (!instrument) throw new Error("Instrument not found");

  const client = new UpstoxClient(userId);
  const config = RANGE_CONFIG[request.range];
  const intraday = INTRADAY[request.interval];
  const [quoteResult, candleResult] = await Promise.all([
    client.getMarketQuotes([request.instrumentKey]),
    config.intraday
      ? client.getIntradayCandles({ instrumentKey: request.instrumentKey, unit: intraday.unit, interval: intraday.interval })
      : client.getHistoricalCandles({
          instrumentKey: request.instrumentKey,
          unit: config.unit,
          interval: config.interval,
          toDate: isoDate(new Date()),
          fromDate: isoDate(new Date(Date.now() - config.days * 86_400_000)),
        }),
  ]);

  const quote = Object.values(quoteResult.data ?? {})[0] ?? null;
  const candles = (candleResult.data?.candles ?? [])
    .map(([timestamp, open, high, low, close, volume]) => ({
      time: Math.floor(new Date(timestamp).getTime() / 1000), open, high, low, close, volume,
    }))
    .filter((item) => Number.isFinite(item.time) && item.time > 0)
    .sort((a, b) => a.time - b.time);

  const previousClose = quote?.last_price != null && quote.net_change != null ? quote.last_price - quote.net_change : null;
  const modelCandles = prepareCandlesForAi(candles);
  const context = {
    asOf: new Date().toISOString(),
    instrument: {
      instrumentKey: instrument.instrumentKey,
      symbol: instrument.tradingSymbol,
      name: instrument.shortName || instrument.name,
      exchange: instrument.exchange,
      segment: instrument.segment,
      isin: instrument.isin,
    },
    chart: {
      range: request.range,
      interval: config.intraday ? request.interval : `${config.interval} ${config.unit}`,
      count: candles.length,
      first: candles[0] ?? null,
      last: candles.at(-1) ?? null,
      high: candles.length ? Math.max(...candles.map((item) => item.high)) : null,
      low: candles.length ? Math.min(...candles.map((item) => item.low)) : null,
      totalVolume: candles.reduce((sum, item) => sum + item.volume, 0),
      ohlcv: {
        order: "oldest-to-newest",
        includedCount: modelCandles.candles.length,
        complete: modelCandles.complete,
        candles: modelCandles.candles,
      },
    },
    liveVision: {
      enabled: request.live,
      frameCapturedAt: request.chartImages?.length ? new Date().toISOString() : null,
      deepAnalysis: request.deepAnalysis,
      note: request.live
        ? "The learner enabled Souji Live. The attached chart frame is the freshest browser view; exact values still come from this server-side OHLCV snapshot."
        : "Souji Live is off. Do not imply continuous visual awareness.",
    },
    quote: quote ? {
      lastPrice: quote.last_price,
      previousClose,
      netChange: quote.net_change,
      volume: quote.volume,
      lastTradedTime: quote.last_traded_time,
    } : null,
    boundaries: {
      educationalOnly: true,
      simulatedTradingOnly: true,
      mayExecuteOrders: false,
    },
  };

  return { context, candles };
}
