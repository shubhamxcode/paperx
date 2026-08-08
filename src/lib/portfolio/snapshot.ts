import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  holdings,
  instruments,
  STARTING_BALANCE_PAISE,
} from "@/db/schema";
import { ensureWallet } from "@/lib/trading/engine";
import {
  marketDataCacheKey,
  withMarketDataCache,
} from "@/lib/upstox/cache";
import {
  MarketDataUnavailableError,
  UpstoxClient,
} from "@/lib/upstox/client";
import type { LTPQuote } from "@/lib/upstox/types";
import {
  calculatePortfolioAnalytics,
  calculatePortfolioMarketDataState,
} from "./analytics";

const LTP_BATCH_SIZE = 50;

function batches<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function getLatestPrices(instrumentKeys: string[]) {
  if (instrumentKeys.length === 0) return [] as LTPQuote[];

  const client = new UpstoxClient();
  const quoteBatches = await Promise.all(
    batches(instrumentKeys, LTP_BATCH_SIZE).map((keys) =>
      withMarketDataCache(
        marketDataCacheKey("portfolio-ltp", [...keys].sort().join(",")),
        5,
        () => client.getLTP(keys)
      )
    )
  );

  return quoteBatches.flatMap((batch) => Object.values(batch.data ?? {}));
}

export async function getPortfolioSnapshot(userId: string) {
  const wallet = await ensureWallet(userId);
  const rows = await db
    .select({
      instrumentKey: holdings.instrumentKey,
      quantity: holdings.quantity,
      avgPricePaise: holdings.avgPricePaise,
      updatedAt: holdings.updatedAt,
      tradingSymbol: instruments.tradingSymbol,
      name: sql<string | null>`coalesce(${instruments.shortName}, ${instruments.name})`,
      exchange: instruments.exchange,
      segment: instruments.segment,
      logoUrl: instruments.logoUrl,
    })
    .from(holdings)
    .innerJoin(instruments, eq(holdings.instrumentKey, instruments.instrumentKey))
    .where(eq(holdings.userId, userId));

  let quotes: LTPQuote[] = [];
  let marketDataAvailable = true;
  try {
    quotes = await getLatestPrices(rows.map((row) => row.instrumentKey));
  } catch (error) {
    if (!(error instanceof MarketDataUnavailableError)) throw error;
    marketDataAvailable = false;
  }

  const enrichedHoldings = rows.map((row) => {
    const quote = quotes.find(
      (item) =>
        item.instrument_token === row.instrumentKey ||
        item.instrument_key === row.instrumentKey
    );
    const ltpPaise =
      quote?.last_price === undefined ? null : Math.round(quote.last_price * 100);
    const investedPaise = row.avgPricePaise * row.quantity;
    const currentPaise =
      ltpPaise === null ? null : ltpPaise * row.quantity;
    const pnlPaise =
      currentPaise === null ? null : currentPaise - investedPaise;

    return {
      instrumentKey: row.instrumentKey,
      name: row.name ?? row.instrumentKey,
      exchange: row.exchange ?? null,
      segment: row.segment ?? null,
      tradingSymbol: row.tradingSymbol ?? null,
      logoUrl: row.logoUrl ?? null,
      quantity: row.quantity,
      avgPricePaise: row.avgPricePaise,
      updatedAt: row.updatedAt,
      ltpPaise,
      latestPricePaise: ltpPaise,
      investedPaise,
      currentPaise,
      pnlPaise,
      pnlPercent:
        pnlPaise === null || investedPaise === 0
          ? null
          : Number(((pnlPaise / investedPaise) * 100).toFixed(2)),
      priceFreshness: ltpPaise === null ? "UNAVAILABLE" : "RECENT",
    } as const;
  });

  const analytics = calculatePortfolioAnalytics(
    enrichedHoldings,
    wallet.balancePaise
  );
  const holdingsWithAllocation = enrichedHoldings.map((holding) => ({
    ...holding,
    allocationPercent:
      analytics.allocationByInstrument[holding.instrumentKey] ?? 0,
  }));
  const investedPaise = enrichedHoldings.reduce(
    (sum, holding) => sum + holding.investedPaise,
    0
  );
  const completeCurrentValue = analytics.priceCoverage.complete;
  const currentPaise = completeCurrentValue
    ? enrichedHoldings.reduce(
        (sum, holding) => sum + (holding.currentPaise ?? 0),
        0
      )
    : null;
  const pnlPaise =
    currentPaise === null ? null : currentPaise - investedPaise;
  const accountValuePaise =
    currentPaise === null ? null : wallet.balancePaise + currentPaise;
  const marketData = calculatePortfolioMarketDataState({
    totalHoldings: rows.length,
    pricedHoldings: analytics.priceCoverage.pricedHoldings,
    providerAvailable: marketDataAvailable,
  });

  return {
    currency: "INR",
    unit: "PAISE",
    generatedAt: new Date().toISOString(),
    marketData,
    wallet: {
      balancePaise: wallet.balancePaise,
      startingBalancePaise: STARTING_BALANCE_PAISE,
    },
    holdings: holdingsWithAllocation,
    totals: {
      investedPaise,
      currentPaise,
      pnlPaise,
      pnlPercent:
        pnlPaise === null || investedPaise === 0
          ? null
          : Number(((pnlPaise / investedPaise) * 100).toFixed(2)),
      accountValuePaise,
      accountPnlPaise:
        accountValuePaise === null
          ? null
          : accountValuePaise - STARTING_BALANCE_PAISE,
      netPnlPaise:
        accountValuePaise === null
          ? null
          : accountValuePaise - STARTING_BALANCE_PAISE,
    },
    analytics,
    livePrices: marketData.livePrices,
  } as const;
}
