import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  addDefaultWatchlistItem,
  removeDefaultWatchlistItem,
  reorderDefaultWatchlistItems,
} from "@/db/watchlists";

const MAX_INSTRUMENT_KEY_LENGTH = 128;

async function authenticatedUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function validInstrumentKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_INSTRUMENT_KEY_LENGTH
  );
}

export async function POST(req: NextRequest) {
  try {
    const userId = await authenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await req.json().catch(() => null);
    const instrumentKey =
      body && typeof body === "object" && "instrumentKey" in body
        ? body.instrumentKey
        : null;
    if (!validInstrumentKey(instrumentKey)) {
      return NextResponse.json(
        { error: "A valid instrumentKey is required" },
        { status: 400 }
      );
    }

    const item = await addDefaultWatchlistItem(userId, instrumentKey);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add instrument";
    const isClientError =
      message === "Instrument not found" || message.startsWith("A watchlist can contain");
    if (!isClientError) console.error("Error adding watchlist item:", error);
    return NextResponse.json(
      { error: isClientError ? message : "Failed to add instrument" },
      { status: isClientError ? 400 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await authenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instrumentKey = req.nextUrl.searchParams.get("instrumentKey");
    if (!validInstrumentKey(instrumentKey)) {
      return NextResponse.json(
        { error: "A valid instrumentKey is required" },
        { status: 400 }
      );
    }

    await removeDefaultWatchlistItem(userId, instrumentKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing watchlist item:", error);
    return NextResponse.json(
      { error: "Failed to remove instrument" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await authenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await req.json().catch(() => null);
    const instrumentKeys =
      body && typeof body === "object" && "instrumentKeys" in body
        ? body.instrumentKeys
        : null;
    if (
      !Array.isArray(instrumentKeys) ||
      instrumentKeys.length > 100 ||
      !instrumentKeys.every(validInstrumentKey) ||
      new Set(instrumentKeys).size !== instrumentKeys.length
    ) {
      return NextResponse.json(
        { error: "instrumentKeys must be a unique list of valid instrument keys" },
        { status: 400 }
      );
    }

    await reorderDefaultWatchlistItems(userId, instrumentKeys);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reorder watchlist";
    const isClientError = message.startsWith("Reorder must include");
    if (!isClientError) console.error("Error reordering watchlist:", error);
    return NextResponse.json(
      { error: isClientError ? message : "Failed to reorder watchlist" },
      { status: isClientError ? 409 : 500 }
    );
  }
}
