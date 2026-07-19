import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { UpstoxClient } from "@/lib/upstox/client";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const upstoxClient = new UpstoxClient(session.user.id);
        const wsAuth = await upstoxClient.getWebSocketAuth();

        return NextResponse.json(wsAuth);
    } catch (error: unknown) {
        console.error(
            "Error getting WebSocket auth:",
            error instanceof Error ? error.message : "Unknown error"
        );
        return NextResponse.json(
            { error: "Failed to get WebSocket authorization" },
            { status: 500 }
        );
    }
}
