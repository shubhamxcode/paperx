import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { UpstoxClient } from "@/lib/upstox/client";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        
        const searchParams = req.nextUrl.searchParams;
        const instrumentKeys = searchParams.getAll("instrument_key");

        if (!instrumentKeys || instrumentKeys.length === 0) {
            return NextResponse.json(
                { error: "No instrument keys provided" },
                { status: 400 }
            );
        }

        const upstoxClient = new UpstoxClient(session.user.id);
        const quotes = await upstoxClient.getMarketQuotes(instrumentKeys);

        return NextResponse.json(quotes);
    } catch (error: any) {
        console.error("Error fetching market quotes:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch market quotes" },
            { status: 500 }
        );
    }
}
