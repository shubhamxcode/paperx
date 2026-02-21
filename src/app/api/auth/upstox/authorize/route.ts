import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { UpstoxClient } from "@/lib/upstox/client";

export async function GET(req: NextRequest) {
    try {
        // Check if user is authenticated
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized. Please login first." },
                { status: 401 }
            );
        }

        
        const userId = session.user.id;
        const upstoxClient = new UpstoxClient(userId);

        // Generate state for CSRF protection
        const state = crypto.randomUUID();

        // Get authorization URL
        const authUrl = upstoxClient.getAuthorizationUrl(state);

        // Store state in session or cookie for verification in callback
        // For now, we'll redirect directly
        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error("Error in Upstox authorization:", error);
        return NextResponse.json(
            { error: "Failed to initiate Upstox authorization" },
            { status: 500 }
        );
    }
}
