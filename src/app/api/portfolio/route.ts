import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getPortfolioSnapshot } from "@/lib/portfolio/snapshot";

/**
 * GET /api/portfolio
 *
 * Wallet, holdings, valuations, and deterministic portfolio analytics.
 * Provider failures degrade to explicit cost-basis data.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(await getPortfolioSnapshot(session.user.id));
  } catch (error: unknown) {
    console.error("Error fetching portfolio:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}
