import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { deleteUpstoxToken } from "@/db/upstox";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        await deleteUpstoxToken(session.user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error disconnecting Upstox:", error);
        return NextResponse.json(
            { error: "Failed to disconnect Upstox" },
            { status: 500 }
        );
    }
}
