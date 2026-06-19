import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { UpstoxClient } from "@/lib/upstox/client";

// Redirect helper that always clears the single-use CSRF state cookie.
function redirect(req: NextRequest, path: string) {
    const res = NextResponse.redirect(new URL(path, req.url));
    res.cookies.delete("upstox_oauth_state");
    return res;
}

export async function GET(req: NextRequest) {
    try {
        // Check if user is authenticated
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.id) {
            return redirect(req, "/login?error=unauthorized");
        }

        const userId = session.user.id;
        const searchParams = req.nextUrl.searchParams;
        const code = searchParams.get("code");
        const error = searchParams.get("error");
        const returnedState = searchParams.get("state");
        const storedState = req.cookies.get("upstox_oauth_state")?.value;

        // Handle authorization errors from Upstox (e.g. user denied access).
        if (error) {
            console.error("Upstox authorization error:", error);
            return redirect(req, "/dashboard?upstox_error=access_denied");
        }

        // CSRF protection: the state returned by Upstox must match the one we
        // set when starting the flow. Reject forged/replayed callbacks.
        if (!storedState || !returnedState || storedState !== returnedState) {
            console.error("Upstox callback: state mismatch (possible CSRF)");
            return redirect(req, "/dashboard?upstox_error=invalid_state");
        }

        // Validate authorization code
        if (!code) {
            return redirect(req, "/dashboard?upstox_error=no_code");
        }

        // Exchange code for access token
        const upstoxClient = new UpstoxClient(userId);
        await upstoxClient.getAccessToken(code);

        return redirect(req, "/dashboard?upstox_connected=true");
    } catch (error) {
        // Log full details server-side only; never reflect internals into the URL.
        console.error("Error in Upstox callback:", error);
        return redirect(req, "/dashboard?upstox_error=connection_failed");
    }
}
