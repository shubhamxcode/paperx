import { db } from "@/db";
import {
  holdings,
  instruments,
  orders,
  wallets,
  type Order,
  type Wallet,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { UpstoxClient } from "@/lib/upstox/client";

/** Only cash equities are tradeable; indices are view-only market context. */
const TRADEABLE_SEGMENTS = ["NSE_EQ", "BSE_EQ"];
const MAX_QUANTITY = 100_000;

/**
 * Bad request from the caller (unknown instrument, invalid quantity, no live
 * price). No order row is written — this never reached the book.
 */
export class TradeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TradeValidationError";
  }
}

export type OrderRequest = {
  userId: string;
  instrumentKey: string;
  side: "BUY" | "SELL";
  quantity: number;
};

export type OrderResult = {
  order: Order;
  /** wallet balance after the order (unchanged if rejected) */
  balancePaise: number;
};

/** Get the user's wallet, creating it with the starting balance on first use. */
export async function ensureWallet(userId: string): Promise<Wallet> {
  await db.insert(wallets).values({ userId }).onConflictDoNothing();
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId));
  return wallet;
}

/** Fetch the live last-traded price for one instrument, in paise. */
async function fetchLivePricePaise(
  userId: string,
  instrumentKey: string
): Promise<number> {
  const client = new UpstoxClient(userId);
  const res = await client.getLTP([instrumentKey]);
  // Upstox keys the response by "EXCHANGE:SYMBOL", so match on instrument_key.
  const quotes = Object.values(res.data ?? {});
  const quote =
    quotes.find((q) => q.instrument_key === instrumentKey) ?? quotes[0];
  const pricePaise = Math.round((quote?.last_price ?? 0) * 100);
  if (!pricePaise || pricePaise <= 0) {
    throw new TradeValidationError(
      "No live price available for this instrument right now."
    );
  }
  return pricePaise;
}

/**
 * Execute a market order atomically.
 *
 * The wallet row is locked (SELECT ... FOR UPDATE) for the whole transaction —
 * and the holding row after it, always in that order — so concurrent orders
 * from the same user serialize instead of double-spending the balance or
 * overselling a position. Business rejections (insufficient funds/shares) are
 * recorded as REJECTED order rows and returned, not thrown.
 */
export async function executeMarketOrder(
  req: OrderRequest
): Promise<OrderResult> {
  const { userId, instrumentKey, side } = req;
  const quantity = req.quantity;

  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
    throw new TradeValidationError(
      `Quantity must be a whole number between 1 and ${MAX_QUANTITY.toLocaleString("en-IN")}.`
    );
  }
  if (side !== "BUY" && side !== "SELL") {
    throw new TradeValidationError("Side must be BUY or SELL.");
  }

  const [instrument] = await db
    .select({
      instrumentKey: instruments.instrumentKey,
      segment: instruments.segment,
      tradingSymbol: instruments.tradingSymbol,
    })
    .from(instruments)
    .where(eq(instruments.instrumentKey, instrumentKey));

  if (!instrument) {
    throw new TradeValidationError("Unknown instrument.");
  }
  if (!TRADEABLE_SEGMENTS.includes(instrument.segment)) {
    throw new TradeValidationError(
      "Only NSE/BSE cash equities can be traded on PaperX."
    );
  }

  // Price is fetched before the transaction so we never hold row locks
  // across a network call.
  const pricePaise = await fetchLivePricePaise(userId, instrumentKey);
  const totalPaise = pricePaise * quantity;

  await ensureWallet(userId);

  return db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .for("update");

    const reject = async (reason: string): Promise<OrderResult> => {
      const [order] = await tx
        .insert(orders)
        .values({ userId, instrumentKey, side, quantity, pricePaise, totalPaise, status: "REJECTED", reason })
        .returning();
      return { order, balancePaise: wallet.balancePaise };
    };

    if (side === "BUY") {
      if (wallet.balancePaise < totalPaise) {
        return reject(
          `Insufficient funds: order needs ₹${(totalPaise / 100).toLocaleString("en-IN")} but wallet has ₹${(wallet.balancePaise / 100).toLocaleString("en-IN")}.`
        );
      }

      const [holding] = await tx
        .select()
        .from(holdings)
        .where(and(eq(holdings.userId, userId), eq(holdings.instrumentKey, instrumentKey)))
        .for("update");

      const newBalance = wallet.balancePaise - totalPaise;
      await tx
        .update(wallets)
        .set({ balancePaise: newBalance, updatedAt: new Date() })
        .where(eq(wallets.userId, userId));

      if (holding) {
        const newQty = holding.quantity + quantity;
        const newAvg = Math.round(
          (holding.avgPricePaise * holding.quantity + totalPaise) / newQty
        );
        await tx
          .update(holdings)
          .set({ quantity: newQty, avgPricePaise: newAvg, updatedAt: new Date() })
          .where(and(eq(holdings.userId, userId), eq(holdings.instrumentKey, instrumentKey)));
      } else {
        await tx
          .insert(holdings)
          .values({ userId, instrumentKey, quantity, avgPricePaise: pricePaise });
      }

      const [order] = await tx
        .insert(orders)
        .values({ userId, instrumentKey, side, quantity, pricePaise, totalPaise, status: "FILLED" })
        .returning();
      return { order, balancePaise: newBalance };
    }

    // SELL
    const [holding] = await tx
      .select()
      .from(holdings)
      .where(and(eq(holdings.userId, userId), eq(holdings.instrumentKey, instrumentKey)))
      .for("update");

    if (!holding || holding.quantity < quantity) {
      return reject(
        `Insufficient shares: you hold ${holding?.quantity ?? 0} ${instrument.tradingSymbol}, tried to sell ${quantity}.`
      );
    }

    const remaining = holding.quantity - quantity;
    if (remaining === 0) {
      await tx
        .delete(holdings)
        .where(and(eq(holdings.userId, userId), eq(holdings.instrumentKey, instrumentKey)));
    } else {
      await tx
        .update(holdings)
        .set({ quantity: remaining, updatedAt: new Date() })
        .where(and(eq(holdings.userId, userId), eq(holdings.instrumentKey, instrumentKey)));
    }

    const newBalance = wallet.balancePaise + totalPaise;
    await tx
      .update(wallets)
      .set({ balancePaise: newBalance, updatedAt: new Date() })
      .where(eq(wallets.userId, userId));

    const [order] = await tx
      .insert(orders)
      .values({ userId, instrumentKey, side, quantity, pricePaise, totalPaise, status: "FILLED" })
      .returning();
    return { order, balancePaise: newBalance };
  });
}
