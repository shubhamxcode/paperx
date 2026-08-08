import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { holdings, instruments } from "@/db/schema";
import { UpstoxClient } from "@/lib/upstox/client";
import type { TutorRequest } from "@/lib/ai/schemas";
import { prepareCandlesForAi } from "@/lib/ai/candle-context";
import { buildTechnicalContext } from "@/lib/ai/technical-context";
import {
  tutorContextSelection,
  type TutorScope,
} from "@/lib/ai/intent";
import { getPortfolioSnapshot } from "@/lib/portfolio/snapshot";
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

export async function buildCurrentStockContext(
  userId: string,
  request: TutorRequest
) {
  const instrumentKey = request.instrumentKey;
  if (!instrumentKey) throw new Error("Stock context requires an instrument");
  const [instrument] = await db.select().from(instruments).where(eq(instruments.instrumentKey, instrumentKey));
  if (!instrument) throw new Error("Instrument not found");

  const client = new UpstoxClient();
  const config = RANGE_CONFIG[request.range];
  const intraday = INTRADAY[request.interval];
  const [quoteResult, candleResult, [holding], profileResult, ratiosResult] = await Promise.all([
    withMarketDataCache(
      marketDataCacheKey("quotes", instrumentKey),
      3,
      () => client.getMarketQuotes([instrumentKey])
    ),
    withMarketDataCache(
      marketDataCacheKey(
        "candles",
        `${instrumentKey}:${request.range}:${
          config.intraday
            ? request.interval
            : `${config.interval}-${config.unit}`
        }`
      ),
      config.intraday ? 15 : 300,
      () =>
        config.intraday
          ? client.getIntradayCandles({
              instrumentKey,
              unit: intraday.unit,
              interval: intraday.interval,
            })
          : client.getHistoricalCandles({
              instrumentKey,
              unit: config.unit,
              interval: config.interval,
              toDate: isoDate(new Date()),
              fromDate: isoDate(new Date(Date.now() - config.days * 86_400_000)),
            })
    ),
    db
      .select({
        quantity: holdings.quantity,
        avgPricePaise: holdings.avgPricePaise,
        updatedAt: holdings.updatedAt,
      })
      .from(holdings)
      .where(
        and(
          eq(holdings.userId, userId),
          eq(holdings.instrumentKey, instrumentKey)
        )
      ),
    instrument.isin
      ? withMarketDataCache(
          marketDataCacheKey("profile", instrument.isin),
          3_600,
          () => client.getCompanyProfile(instrument.isin!)
        ).catch(() => null)
      : Promise.resolve(null),
    instrument.isin
      ? withMarketDataCache(
          marketDataCacheKey("ratios", instrument.isin),
          3_600,
          () => client.getKeyRatios(instrument.isin!)
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  const quotes = Object.values(quoteResult.data ?? {});
  const quote =
    quotes.find((item) => item.instrument_key === instrumentKey) ??
    quotes[0] ??
    null;
  const candles = (candleResult.data?.candles ?? [])
    .map(([timestamp, open, high, low, close, volume]) => ({
      time: Math.floor(new Date(timestamp).getTime() / 1000), open, high, low, close, volume,
    }))
    .filter((item) => Number.isFinite(item.time) && item.time > 0)
    .sort((a, b) => a.time - b.time);

  const previousClose = quote?.last_price != null && quote.net_change != null ? quote.last_price - quote.net_change : null;
  const modelCandles = prepareCandlesForAi(candles);
  const fetchedAt = new Date().toISOString();
  const context = {
    contextVersion: 2,
    scope: "CURRENT_STOCK",
    fetchedAt,
    timezone: "Asia/Kolkata",
    sourcePolicy: {
      provider: "Upstox read-only market data",
      exactValues: "Use quote and chart.ohlcv; never infer exact prices from image pixels.",
      visualFrame: "The image contains only the learner's visible chart viewport.",
    },
    instrument: {
      instrumentKey: instrument.instrumentKey,
      symbol: instrument.tradingSymbol,
      name: instrument.shortName || instrument.name,
      exchange: instrument.exchange,
      segment: instrument.segment,
      isin: instrument.isin,
      instrumentType: instrument.instrumentType,
      tickSize: instrument.tickSize,
    },
    quote: quote ? {
      lastPrice: quote.last_price,
      previousClose,
      netChange: quote.net_change,
      netChangePercent:
        previousClose && quote.net_change != null
          ? (quote.net_change / previousClose) * 100
          : null,
      volume: quote.volume,
      averagePrice: quote.average_price,
      totalBuyQuantity: quote.total_buy_quantity,
      totalSellQuantity: quote.total_sell_quantity,
      lowerCircuitLimit: quote.lower_circuit_limit,
      upperCircuitLimit: quote.upper_circuit_limit,
      lastTradedTime: quote.last_traded_time,
    } : null,
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
      technicals: buildTechnicalContext(candles),
    },
    company: {
      profile: profileResult?.data ?? null,
      keyRatios: ratiosResult?.data ?? [],
    },
    learnerPaperPosition: holding
      ? {
          quantity: holding.quantity,
          averageBuyPrice: holding.avgPricePaise / 100,
          costBasis: (holding.avgPricePaise * holding.quantity) / 100,
          updatedAt: holding.updatedAt.toISOString(),
        }
      : { quantity: 0, averageBuyPrice: null, costBasis: 0, updatedAt: null },
    visibleChartFrame: {
      attached: Boolean(request.chartImages?.length),
      capturedAt: request.chartImages?.length ? fetchedAt : null,
      note: request.chartImages?.length
        ? "This frame is the visible browser viewport captured for the current question. Exact values come from chart.ohlcv."
        : "No chart image was needed for this question.",
    },
    boundaries: {
      educationalOnly: true,
      simulatedTradingOnly: true,
      mayExecuteOrders: false,
    },
  };

  return { context, candles };
}

export async function buildPortfolioContext(userId: string) {
  return {
    contextVersion: 3,
    scope: "PORTFOLIO",
    portfolio: await getPortfolioSnapshot(userId),
    sourcePolicy: {
      ownership: "Authenticated server session",
      identityFieldsIncluded: false,
      exactValues:
        "All monetary values are integer paise in INR. Use supplied totals and analytics; do not reconstruct exact totals from prose.",
    },
    boundaries: {
      educationalOnly: true,
      simulatedTradingOnly: true,
      mayExecuteOrders: false,
      riskToleranceKnown: false,
      timeHorizonKnown: false,
    },
  } as const;
}

export async function buildTutorContext(
  userId: string,
  request: TutorRequest,
  scope: TutorScope
) {
  const selection = tutorContextSelection(scope);
  if (selection.portfolio && !selection.stock) {
    return { context: await buildPortfolioContext(userId), candles: [] };
  }
  if (selection.portfolio && selection.stock) {
    const [stock, portfolio] = await Promise.all([
      buildCurrentStockContext(userId, request),
      getPortfolioSnapshot(userId),
    ]);
    return {
      context: {
        ...stock.context,
        contextVersion: 3,
        scope: "CURRENT_STOCK_AND_PORTFOLIO",
        portfolio,
      },
      candles: stock.candles,
    };
  }
  if (!selection.stock) {
    throw new Error(`No market context is defined for ${scope}`);
  }
  return buildCurrentStockContext(userId, request);
}
