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

        // Generate a random state for CSRF protection and stash it in an
        // httpOnly cookie so the callback can verify the response came from a
        // flow this user actually started.
        const state = crypto.randomUUID();
        const authUrl = upstoxClient.getAuthorizationUrl(state);

        const response = NextResponse.redirect(authUrl);
        response.cookies.set("upstox_oauth_state", state, {
            httpOnly: true,
            secure: true,
            sameSite: "lax", // must survive the cross-site redirect back from Upstox
            path: "/",
            maxAge: 60 * 10, // 10 minutes
        });
        return response;
    } catch (error) {
        console.error("Error in Upstox authorization:", error);
        return NextResponse.json(
            { error: "Failed to initiate Upstox authorization" },
            { status: 500 }
        );
    }
}
