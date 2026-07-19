import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { UpstoxClient, UpstoxAuthError } from "@/lib/upstox/client";

const MAX_INSTRUMENTS = 50;
const MAX_INSTRUMENT_KEY_LENGTH = 128;

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

        if (
            instrumentKeys.length > MAX_INSTRUMENTS ||
            instrumentKeys.some((key) => !key || key.length > MAX_INSTRUMENT_KEY_LENGTH)
        ) {
            return NextResponse.json(
                { error: `Provide at most ${MAX_INSTRUMENTS} valid instrument keys` },
                { status: 400 }
            );
        }

        const upstoxClient = new UpstoxClient(session.user.id);
        const quotes = await upstoxClient.getMarketQuotes(instrumentKeys);

        return NextResponse.json(quotes);
    } catch (error: unknown) {
        console.error(
            "Error fetching market quotes:",
            error instanceof Error ? error.message : "Unknown error"
        );
        // Only a genuine Upstox session failure asks the user to reconnect.
        // Everything else is a normal error (500).
        if (error instanceof UpstoxAuthError) {
            return NextResponse.json(
                { error: "Upstox session expired", reconnect: true },
                { status: 401 }
            );
        }
        return NextResponse.json(
            { error: "Failed to fetch market quotes", reconnect: false },
            { status: 500 }
        );
    }
}
