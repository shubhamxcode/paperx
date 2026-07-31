import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, count, eq } from "drizzle-orm";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { holdings, orders, STARTING_BALANCE_PAISE, users, watchlistItems, watchlists } from "@/db/schema";
import {
  ensureUserSettings,
  PROFILE_SETTING_OPTIONS,
  type ProfileSettingsUpdate,
  updateUserSettings,
} from "@/db/profile";
import { getUpstoxToken, isTokenExpired } from "@/db/upstox";
import { ensureWallet } from "@/lib/trading/engine";

async function currentUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === "string" && options.includes(value);
}

function parseSettings(value: unknown): ProfileSettingsUpdate | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const booleanKeys = [
    "orderConfirmation",
    "orderUpdates",
    "marketAlerts",
    "learningReminders",
    "compactMode",
  ] as const;
  if (
    !isOneOf(body.preferredExchange, PROFILE_SETTING_OPTIONS.preferredExchange) ||
    !isOneOf(body.chartInterval, PROFILE_SETTING_OPTIONS.chartInterval) ||
    !isOneOf(body.defaultProduct, PROFILE_SETTING_OPTIONS.defaultProduct) ||
    !booleanKeys.every((key) => typeof body[key] === "boolean")
  ) {
    return null;
  }
  return {
    preferredExchange: body.preferredExchange,
    chartInterval: body.chartInterval,
    defaultProduct: body.defaultProduct,
    orderConfirmation: body.orderConfirmation as boolean,
    orderUpdates: body.orderUpdates as boolean,
    marketAlerts: body.marketAlerts as boolean,
    learningReminders: body.learningReminders as boolean,
    compactMode: body.compactMode as boolean,
  };
}

export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [user, wallet, settings, holdingTotal, orderTotal, watchlistTotal, token] =
      await Promise.all([
        db.select().from(users).where(eq(users.id, userId)).limit(1).then((rows) => rows[0]),
        ensureWallet(userId),
        ensureUserSettings(userId),
        db.select({ value: count() }).from(holdings).where(eq(holdings.userId, userId)).then((rows) => rows[0].value),
        db.select({ value: count() }).from(orders).where(eq(orders.userId, userId)).then((rows) => rows[0].value),
        db
          .select({ value: count() })
          .from(watchlistItems)
          .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
          .where(and(eq(watchlists.userId, userId), eq(watchlists.isDefault, true)))
          .then((rows) => rows[0].value),
        getUpstoxToken(userId),
      ]);
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    return NextResponse.json({
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        provider: "Google",
        memberSince: settings.createdAt,
      },
      paperAccount: {
        balancePaise: wallet.balancePaise,
        startingBalancePaise: STARTING_BALANCE_PAISE,
        holdingCount: holdingTotal,
        orderCount: orderTotal,
        watchlistCount: watchlistTotal,
      },
      connections: {
        google: true,
        upstox: {
          connected: Boolean(token && !isTokenExpired(token.expiresAt)),
          expired: Boolean(token && isTokenExpired(token.expiresAt)),
          expiresAt: token?.expiresAt ?? null,
        },
      },
      settings,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const settings = parseSettings(await request.json().catch(() => null));
    if (!settings) {
      return NextResponse.json({ error: "Invalid profile settings" }, { status: 400 });
    }
    return NextResponse.json({ settings: await updateUserSettings(userId, settings) });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body: unknown = await request.json().catch(() => null);
    const confirmation = body && typeof body === "object" && "confirmation" in body
      ? body.confirmation
      : null;
    if (confirmation !== "DELETE") {
      return NextResponse.json({ error: 'Type "DELETE" to confirm account deletion' }, { status: 400 });
    }
    await db.delete(users).where(eq(users.id, userId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
