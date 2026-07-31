import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { STARTING_BALANCE_PAISE } from "@/db/schema";
import { ensureWallet } from "@/lib/trading/engine";

/**
 * GET /api/wallet
 * Lightweight cash-balance endpoint (for the navbar); the wallet is created
 * with the ₹10L starting balance on first call.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const wallet = await ensureWallet(session.user.id);
    return NextResponse.json({
      balancePaise: wallet.balancePaise,
      startingBalancePaise: STARTING_BALANCE_PAISE,
    });
  } catch (error: unknown) {
    console.error("Error fetching wallet:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet" },
      { status: 500 }
    );
  }
}
