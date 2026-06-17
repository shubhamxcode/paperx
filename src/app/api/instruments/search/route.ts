import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { searchInstruments } from "@/db/instruments";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const q = req.nextUrl.searchParams.get("q") ?? "";
        if (q.trim().length < 1) {
            return NextResponse.json({ results: [] });
        }

        const results = await searchInstruments(q);
        return NextResponse.json({ results });
    } catch (error: any) {
        console.error("Error searching instruments:", error);
        return NextResponse.json(
            { error: error.message || "Failed to search instruments" },
            { status: 500 }
        );
    }
}
