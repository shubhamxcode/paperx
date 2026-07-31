import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { instruments, orders } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const MAX_LIMIT = 100;

/**
 * GET /api/orders?limit=50&offset=0
 * The signed-in user's order history (filled and rejected), newest first.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const limit = Math.min(
      Math.max(parseInt(params.get("limit") ?? "50", 10) || 50, 1),
      MAX_LIMIT
    );
    const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);

    // Fetch one extra row to know whether another page exists.
    const rows = await db
      .select({
        id: orders.id,
        instrumentKey: orders.instrumentKey,
        side: orders.side,
        quantity: orders.quantity,
        pricePaise: orders.pricePaise,
        totalPaise: orders.totalPaise,
        status: orders.status,
        reason: orders.reason,
        createdAt: orders.createdAt,
        tradingSymbol: instruments.tradingSymbol,
        name: instruments.name,
        exchange: instruments.exchange,
      })
      .from(orders)
      .innerJoin(instruments, eq(orders.instrumentKey, instruments.instrumentKey))
      .where(eq(orders.userId, session.user.id))
      .orderBy(desc(orders.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    return NextResponse.json({
      orders: hasMore ? rows.slice(0, limit) : rows,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    });
  } catch (error: unknown) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
