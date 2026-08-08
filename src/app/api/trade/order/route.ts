import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { MarketDataUnavailableError } from "@/lib/upstox/client";
import {
  executeMarketOrder,
  TradeValidationError,
} from "@/lib/trading/engine";

/**
 * POST /api/trade/order
 * Body: { instrumentKey: string, side: "BUY" | "SELL", quantity: number }
 *
 * Executes a market order at the live Upstox price. Business rejections
 * (insufficient funds/shares) come back 200 with order.status = "REJECTED";
 * invalid input is 400; unavailable authoritative market data returns 503.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { instrumentKey, side, quantity } = (body ?? {}) as {
      instrumentKey?: unknown;
      side?: unknown;
      quantity?: unknown;
    };

    if (typeof instrumentKey !== "string" || !instrumentKey || instrumentKey.length > 64) {
      return NextResponse.json({ error: "instrumentKey is required" }, { status: 400 });
    }
    if (side !== "BUY" && side !== "SELL") {
      return NextResponse.json({ error: "side must be BUY or SELL" }, { status: 400 });
    }
    if (typeof quantity !== "number") {
      return NextResponse.json({ error: "quantity must be a number" }, { status: 400 });
    }

    const result = await executeMarketOrder({
      userId: session.user.id,
      instrumentKey,
      side,
      quantity,
    });

    return NextResponse.json({
      order: result.order,
      balancePaise: result.balancePaise,
    });
  } catch (error: unknown) {
    if (error instanceof TradeValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof MarketDataUnavailableError) {
      return NextResponse.json(
        { error: error.message, marketDataUnavailable: true },
        { status: 503 }
      );
    }
    console.error("Error executing order:", error);
    return NextResponse.json(
      { error: "Failed to execute order" },
      { status: 500 }
    );
  }
}
