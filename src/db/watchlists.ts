import { db } from "@/db";
import { instruments, watchlistItems, watchlists } from "@/db/schema";
import { and, asc, count, eq, inArray, max, sql } from "drizzle-orm";

export const DEFAULT_WATCHLIST_NAME = "My Watchlist";
export const MAX_WATCHLIST_ITEMS = 100;

export type WatchlistInstrument = {
  key: string;
  symbol: string;
  exchange: string;
};

/** Return the user's default watchlist, creating it exactly once if needed. */
export async function ensureDefaultWatchlist(userId: string) {
  await db
    .insert(watchlists)
    .values({ userId, name: DEFAULT_WATCHLIST_NAME, isDefault: true })
    .onConflictDoNothing({ target: [watchlists.userId, watchlists.name] });

  const [watchlist] = await db
    .select()
    .from(watchlists)
    .where(
      and(
        eq(watchlists.userId, userId),
        eq(watchlists.name, DEFAULT_WATCHLIST_NAME)
      )
    )
    .limit(1);

  if (!watchlist) throw new Error("Unable to create the default watchlist");
  return watchlist;
}

export async function getDefaultWatchlist(userId: string) {
  const watchlist = await ensureDefaultWatchlist(userId);
  const items = await db
    .select({
      key: instruments.instrumentKey,
      symbol: instruments.tradingSymbol,
      exchange: instruments.exchange,
    })
    .from(watchlistItems)
    .innerJoin(
      instruments,
      eq(watchlistItems.instrumentKey, instruments.instrumentKey)
    )
    .where(eq(watchlistItems.watchlistId, watchlist.id))
    .orderBy(asc(watchlistItems.sortOrder), asc(watchlistItems.createdAt));

  return { id: watchlist.id, name: watchlist.name, items };
}

export async function addDefaultWatchlistItem(
  userId: string,
  instrumentKey: string
): Promise<WatchlistInstrument> {
  const watchlist = await ensureDefaultWatchlist(userId);
  return db.transaction(async (tx) => {
    const [instrument] = await tx
      .select({
        key: instruments.instrumentKey,
        symbol: instruments.tradingSymbol,
        exchange: instruments.exchange,
      })
      .from(instruments)
      .where(eq(instruments.instrumentKey, instrumentKey))
      .limit(1);

    if (!instrument) throw new Error("Instrument not found");

    const existing = await tx
      .select({ key: watchlistItems.instrumentKey })
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.watchlistId, watchlist.id),
          eq(watchlistItems.instrumentKey, instrumentKey)
        )
      )
      .limit(1);
    if (existing.length > 0) return instrument;

    const [{ itemCount, maxSortOrder }] = await tx
      .select({
        itemCount: count(),
        maxSortOrder: max(watchlistItems.sortOrder),
      })
      .from(watchlistItems)
      .where(eq(watchlistItems.watchlistId, watchlist.id));
    if (itemCount >= MAX_WATCHLIST_ITEMS) {
      throw new Error(`A watchlist can contain at most ${MAX_WATCHLIST_ITEMS} instruments`);
    }
    const nextSortOrder = (maxSortOrder ?? -1) + 1;

    await tx.insert(watchlistItems).values({
      watchlistId: watchlist.id,
      instrumentKey,
      sortOrder: nextSortOrder,
    });
    await tx
      .update(watchlists)
      .set({ updatedAt: new Date() })
      .where(eq(watchlists.id, watchlist.id));
    return instrument;
  });
}

export async function removeDefaultWatchlistItem(
  userId: string,
  instrumentKey: string
) {
  const watchlist = await ensureDefaultWatchlist(userId);
  await db
    .delete(watchlistItems)
    .where(
      and(
        eq(watchlistItems.watchlistId, watchlist.id),
        eq(watchlistItems.instrumentKey, instrumentKey)
      )
    );
  await db
    .update(watchlists)
    .set({ updatedAt: new Date() })
    .where(eq(watchlists.id, watchlist.id));
}

export async function reorderDefaultWatchlistItems(
  userId: string,
  instrumentKeys: string[]
) {
  const watchlist = await ensureDefaultWatchlist(userId);

  await db.transaction(async (tx) => {
    const currentItems = await tx
      .select({ key: watchlistItems.instrumentKey })
      .from(watchlistItems)
      .where(eq(watchlistItems.watchlistId, watchlist.id));
    const currentKeys = new Set(currentItems.map((item) => item.key));

    if (
      currentKeys.size !== instrumentKeys.length ||
      instrumentKeys.some((key) => !currentKeys.has(key))
    ) {
      throw new Error("Reorder must include every current watchlist instrument exactly once");
    }

    if (instrumentKeys.length > 0) {
      const orderSql = sql.join(
        instrumentKeys.map(
          (key, index) => sql`when ${watchlistItems.instrumentKey} = ${key} then ${index}`
        ),
        sql.raw(" ")
      );
      await tx
        .update(watchlistItems)
        .set({ sortOrder: sql`case ${orderSql} else ${watchlistItems.sortOrder} end` })
        .where(
          and(
            eq(watchlistItems.watchlistId, watchlist.id),
            inArray(watchlistItems.instrumentKey, instrumentKeys)
          )
        );
    }

    await tx
      .update(watchlists)
      .set({ updatedAt: new Date() })
      .where(eq(watchlists.id, watchlist.id));
  });
}
