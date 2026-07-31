import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { holdings, orders, STARTING_BALANCE_PAISE, wallets } from "@/db/schema";
import { ensureWallet } from "@/lib/trading/engine";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body: unknown = await request.json().catch(() => null);
    const confirmation = body && typeof body === "object" && "confirmation" in body
      ? body.confirmation
      : null;
    if (confirmation !== "RESET") {
      return NextResponse.json({ error: 'Type "RESET" to confirm' }, { status: 400 });
    }

    const userId = session.user.id;
    await ensureWallet(userId);
    await db.transaction(async (tx) => {
      // Serialize reset against order execution, which locks the same wallet row.
      await tx
        .select({ userId: wallets.userId })
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .for("update");
      await tx.delete(holdings).where(eq(holdings.userId, userId));
      await tx.delete(orders).where(eq(orders.userId, userId));
      await tx
        .update(wallets)
        .set({ balancePaise: STARTING_BALANCE_PAISE, updatedAt: new Date() })
        .where(eq(wallets.userId, userId));
    });
    return NextResponse.json({ success: true, balancePaise: STARTING_BALANCE_PAISE });
  } catch (error) {
    console.error("Error resetting paper account:", error);
    return NextResponse.json({ error: "Failed to reset paper account" }, { status: 500 });
  }
}
