import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUpstoxToken, isTokenExpired, expireUpstoxToken } from "@/db/upstox";
import { UpstoxClient } from "@/lib/upstox/client";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.id) {
            return NextResponse.json(
                { connected: false, expired: false, expiresAt: null },
                { status: 200 }
            );
        }

        const userId = session.user.id;
        const token = await getUpstoxToken(userId);

        if (!token) {
            return NextResponse.json({
                connected: false,
                expired: false,
                expiresAt: null,
            });
        }

        // Fast path: stored expiry already says it's dead.
        if (isTokenExpired(token.expiresAt)) {
            return NextResponse.json({
                connected: false,
                expired: true,
                expiresAt: token.expiresAt,
            });
        }

        // Stored expiry says valid — verify against Upstox so a token that
        // Upstox has actually rejected (wrong stored expiry, revoked, daily
        // reset) is reported as "reconnect needed" and synced in the DB.
        try {
            const valid = await new UpstoxClient(userId).validateToken();
            if (!valid) {
                await expireUpstoxToken(userId);
                return NextResponse.json({
                    connected: false,
                    expired: true,
                    expiresAt: new Date(0),
                });
            }
        } catch {
            // Transient/network error — trust the stored expiry, stay connected.
        }

        return NextResponse.json({
            connected: true,
            expired: false,
            expiresAt: token.expiresAt,
        });
    } catch (error) {
        console.error("Error checking Upstox status:", error);
        return NextResponse.json(
            { connected: false, expired: false, expiresAt: null },
            { status: 200 }
        );
    }
}
