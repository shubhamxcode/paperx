import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { UpstoxClient } from "@/lib/upstox/client";

export async function GET(req: NextRequest) {
    try {
        // Check if user is authenticated
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.id) {
            return NextResponse.redirect(
                new URL("/login?error=unauthorized", req.url)
            );
        }

        const userId = session.user.id;
        const searchParams = req.nextUrl.searchParams;
        const code = searchParams.get("code");
        const error = searchParams.get("error");

        // Handle authorization errors
        if (error) {
            console.error("Upstox authorization error:", error);
            return NextResponse.redirect(
                new URL(`/dashboard?upstox_error=${error}`, req.url)
            );
        }

        // Validate authorization code
        if (!code) {
            return NextResponse.redirect(
                new URL("/dashboard?upstox_error=no_code", req.url)
            );
        }

        // Exchange code for access token
        const upstoxClient = new UpstoxClient(userId);
        await upstoxClient.getAccessToken(code);

        // Redirect to dashboard with success message
        return NextResponse.redirect(
            new URL("/dashboard?upstox_connected=true", req.url)
        );
    } catch (error: any) {
        console.error("Error in Upstox callback:", error);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        return NextResponse.redirect(
            new URL(`/dashboard?upstox_error=${encodeURIComponent(error.message || "token_exchange_failed")}`, req.url)
        );
    }
}
