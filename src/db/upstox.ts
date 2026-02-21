import { db } from "./index";
import { upstoxTokens } from "./schema";
import { eq } from "drizzle-orm";
import type { UpstoxToken } from "@/lib/upstox/types";

export async function getUpstoxToken(userId: string): Promise<UpstoxToken | null> {
    const result = await db
        .select()
        .from(upstoxTokens)
        .where(eq(upstoxTokens.userId, userId))
        .limit(1);

    console.log(`result:`,result);
    if (result.length === 0) {
        return null;
    }
    const token = result[0];
    return {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expireAt,
    };
}

export async function saveUpstoxToken(
    userId: string,
    token: UpstoxToken
): Promise<void> {
    const existing = await db
        .select()
        .from(upstoxTokens)
        .where(eq(upstoxTokens.userId, userId))
        .limit(1);

    if (existing.length > 0) {
        // Update existing token
        await db
            .update(upstoxTokens)
            .set({
                accessToken: token.accessToken,
                refreshToken: token.refreshToken,
                expireAt: token.expiresAt,
                updatedAt: new Date(),
            })
            .where(eq(upstoxTokens.userId, userId));
    } else {
        // Insert new token
        await db.insert(upstoxTokens).values({
            userId,
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expireAt: token.expiresAt,
        });
    }
}

export async function deleteUpstoxToken(userId: string): Promise<void> {
    await db.delete(upstoxTokens).where(eq(upstoxTokens.userId, userId));
}

export function isTokenExpired(expiresAt: Date): boolean {
    return new Date() >= expiresAt;
}
