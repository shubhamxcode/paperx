import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDefaultWatchlist } from "@/db/watchlists";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const watchlist = await getDefaultWatchlist(session.user.id);
    return NextResponse.json({ watchlist });
  } catch (error) {
    console.error("Error loading watchlist:", error);
    return NextResponse.json(
      { error: "Failed to load watchlist" },
      { status: 500 }
    );
  }
}
