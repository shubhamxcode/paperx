import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import {
  holdings,
  instruments,
  watchlistItems,
  watchlists,
} from "@/db/schema";
import { ensureWallet } from "@/lib/trading/engine";
import { UpstoxAuthError, UpstoxClient } from "@/lib/upstox/client";

type RouteContext = { params: Promise<{ instrumentKey: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { instrumentKey: rawKey } = await context.params;
    const instrumentKey = decodeURIComponent(rawKey);
    if (!instrumentKey || instrumentKey.length > 128) {
      return NextResponse.json({ error: "Invalid instrument key" }, { status: 400 });
    }

    const [instrument] = await db
      .select()
      .from(instruments)
      .where(eq(instruments.instrumentKey, instrumentKey));
    if (!instrument) {
      return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
    }

    const userId = session.user.id;
    const wallet = await ensureWallet(userId);
    const [[holding], [watchlistItem]] = await Promise.all([
      db
        .select({ quantity: holdings.quantity, avgPricePaise: holdings.avgPricePaise })
        .from(holdings)
        .where(and(eq(holdings.userId, userId), eq(holdings.instrumentKey, instrumentKey))),
      db
        .select({ instrumentKey: watchlistItems.instrumentKey })
        .from(watchlistItems)
        .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
        .where(and(eq(watchlists.userId, userId), eq(watchlistItems.instrumentKey, instrumentKey))),
    ]);

    const client = new UpstoxClient(userId);
    const [quoteResult, profileResult, ratiosResult, quarterlyResult, yearlyResult] = await Promise.allSettled([
      client.getMarketQuotes([instrumentKey]),
      instrument.isin ? client.getCompanyProfile(instrument.isin) : Promise.resolve(null),
      instrument.isin ? client.getKeyRatios(instrument.isin) : Promise.resolve(null),
      instrument.isin ? client.getIncomeStatement(instrument.isin, "quarterly") : Promise.resolve(null),
      instrument.isin ? client.getIncomeStatement(instrument.isin, "yearly") : Promise.resolve(null),
    ]);

    if (quoteResult.status === "rejected" && quoteResult.reason instanceof UpstoxAuthError) {
      throw quoteResult.reason;
    }

    const quote = quoteResult.status === "fulfilled"
      ? Object.values(quoteResult.value.data ?? {})[0] ?? null
      : null;

    return NextResponse.json({
      instrument: {
        instrumentKey: instrument.instrumentKey,
        tradingSymbol: instrument.tradingSymbol,
        name: instrument.shortName || instrument.name,
        exchange: instrument.exchange,
        segment: instrument.segment,
        instrumentType: instrument.instrumentType,
        isin: instrument.isin,
        logoUrl: instrument.logoUrl,
        tickSize: instrument.tickSize,
      },
      tradeable: ["NSE_EQ", "BSE_EQ"].includes(instrument.segment),
      wallet: { balancePaise: wallet.balancePaise },
      holding: holding ?? { quantity: 0, avgPricePaise: null },
      inWatchlist: Boolean(watchlistItem),
      quote,
      companyProfile: profileResult.status === "fulfilled" ? profileResult.value?.data ?? null : null,
      ratios: ratiosResult.status === "fulfilled" ? ratiosResult.value?.data ?? [] : [],
      income: {
        quarterly: quarterlyResult.status === "fulfilled" ? quarterlyResult.value?.data ?? null : null,
        yearly: yearlyResult.status === "fulfilled" ? yearlyResult.value?.data ?? null : null,
      },
      availability: {
        quote: quoteResult.status === "fulfilled",
        fundamentals: Boolean(
          profileResult.status === "fulfilled" &&
          ratiosResult.status === "fulfilled" &&
          quarterlyResult.status === "fulfilled" &&
          yearlyResult.status === "fulfilled"
        ),
      },
    });
  } catch (error: unknown) {
    if (error instanceof UpstoxAuthError) {
      return NextResponse.json({ error: error.message, reconnect: true }, { status: 401 });
    }
    console.error("Error loading stock detail:", error);
    return NextResponse.json({ error: "Failed to load stock details" }, { status: 500 });
  }
}
