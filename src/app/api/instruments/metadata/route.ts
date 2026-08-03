import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { inArray } from "drizzle-orm";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { instruments } from "@/db/schema";

const MAX_INSTRUMENTS = 50;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = [...new Set(request.nextUrl.searchParams.getAll("instrument_key"))];
  if (!keys.length || keys.length > MAX_INSTRUMENTS || keys.some((key) => !key || key.length > 128)) {
    return NextResponse.json({ error: `Provide 1-${MAX_INSTRUMENTS} valid instrument keys` }, { status: 400 });
  }

  const rows = await db.select({
    instrumentKey: instruments.instrumentKey,
    logoUrl: instruments.logoUrl,
  }).from(instruments).where(inArray(instruments.instrumentKey, keys));

  return NextResponse.json({ instruments: rows });
}
