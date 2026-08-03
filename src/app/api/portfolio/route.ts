import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { holdings, instruments, STARTING_BALANCE_PAISE } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { UpstoxClient, UpstoxAuthError } from "@/lib/upstox/client";
import { ensureWallet } from "@/lib/trading/engine";

/**
 * GET /api/portfolio
 *
 * Wallet + holdings with live P&L. If the daily Upstox token has expired the
 * portfolio still returns (cost basis only) with livePrices: false, so the
 * dashboard never hard-fails just because market data is unavailable.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

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

    // Live prices are best-effort: an expired Upstox session degrades to
    // cost-basis-only rather than failing the whole portfolio.
    let prices: Record<string, number> | null = null;
    if (rows.length > 0) {
      try {
        const client = new UpstoxClient(userId);
        const res = await client.getLTP(rows.map((r) => r.instrumentKey));
        prices = {};
        for (const quote of Object.values(res.data ?? {})) {
          const instrumentKey = quote.instrument_token || quote.instrument_key;
          if (instrumentKey && Number.isFinite(quote.last_price)) {
            prices[instrumentKey] = Math.round(quote.last_price * 100);
          }
        }
      } catch (error) {
        if (!(error instanceof UpstoxAuthError)) throw error;
        prices = null;
      }
    }

    let investedPaise = 0;
    let currentPaise = 0;
    let priced = 0;

    const enriched = rows.map((r) => {
      const invested = r.avgPricePaise * r.quantity;
      investedPaise += invested;
      const ltpPaise = prices?.[r.instrumentKey] ?? null;
      const current = ltpPaise !== null ? ltpPaise * r.quantity : null;
      if (current !== null) {
        currentPaise += current;
        priced++;
      }
      return {
        ...r,
        investedPaise: invested,
        ltpPaise,
        currentPaise: current,
        pnlPaise: current !== null ? current - invested : null,
        pnlPercent:
          current !== null && invested > 0
            ? ((current - invested) / invested) * 100
            : null,
      };
    });

    const livePrices = rows.length > 0 && priced === rows.length;

    return NextResponse.json({
      wallet: {
        balancePaise: wallet.balancePaise,
        startingBalancePaise: STARTING_BALANCE_PAISE,
      },
      holdings: enriched,
      totals: {
        investedPaise,
        currentPaise: livePrices ? currentPaise : null,
        pnlPaise: livePrices ? currentPaise - investedPaise : null,
        // account = cash + market value of holdings; net P&L vs the ₹10L start
        accountValuePaise: livePrices ? wallet.balancePaise + currentPaise : null,
        netPnlPaise: livePrices
          ? wallet.balancePaise + currentPaise - STARTING_BALANCE_PAISE
          : null,
      },
      livePrices,
    });
  } catch (error: unknown) {
    console.error("Error fetching portfolio:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}
