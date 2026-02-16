import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUpstoxToken } from "@/db/upstox";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.id) {
            return NextResponse.json(
                { connected: false },
                { status: 200 }
            );
        }

        const token = await getUpstoxToken(session.user.id);

        return NextResponse.json({
            connected: !!token,
            expiresAt: token?.expiresAt || null,
        });
    } catch (error) {
        console.error("Error checking Upstox status:", error);
        return NextResponse.json(
            { connected: false },
            { status: 200 }
        );
    }
}
