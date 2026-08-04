import { db } from "@/db";
import {
  holdingLots,
  holdings,
  instruments,
  orders,
  wallets,
  type Order,
  type Wallet,
} from "@/db/schema";
import { and, asc, eq, gt } from "drizzle-orm";
import { UpstoxClient } from "@/lib/upstox/client";
import {
  calculateAveragePricePaise,
  calculateSaleProceedsPaise,
  consumeFifoLots,
} from "@/lib/trading/calculations";
import {
  getScheduledMarketStatus,
  MARKET_CLOSED_MESSAGE,
} from "@/lib/trading/market-hours";

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
  client: UpstoxClient,
  instrumentKey: string
): Promise<number> {
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
      exchange: instruments.exchange,
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

  // Reject locally first and again immediately before entering the transaction,
  // so an order cannot cross the 15:30 IST boundary while market data is fetched.
  if (!getScheduledMarketStatus().open) {
    throw new TradeValidationError(MARKET_CLOSED_MESSAGE);
  }

  const exchange = instrument.exchange === "BSE" ? "BSE" : "NSE";
  const client = new UpstoxClient(userId);
  const marketStatus = await client.getMarketStatus(exchange);
  if (marketStatus.data.status !== "NORMAL_OPEN") {
    throw new TradeValidationError(MARKET_CLOSED_MESSAGE);
  }

  // Price is fetched before the transaction so we never hold row locks
  // across a network call.
  const pricePaise = await fetchLivePricePaise(client, instrumentKey);
  const totalPaise =
    side === "SELL"
      ? calculateSaleProceedsPaise(quantity, pricePaise)
      : pricePaise * quantity;

  if (!getScheduledMarketStatus().open) {
    throw new TradeValidationError(MARKET_CLOSED_MESSAGE);
  }

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

    const [holding] = await tx
      .select()
      .from(holdings)
      .where(and(eq(holdings.userId, userId), eq(holdings.instrumentKey, instrumentKey)))
      .for("update");

    let lots = await tx
      .select({
        id: holdingLots.id,
        remainingQuantity: holdingLots.remainingQuantity,
        pricePaise: holdingLots.pricePaise,
      })
      .from(holdingLots)
      .where(
        and(
          eq(holdingLots.userId, userId),
          eq(holdingLots.instrumentKey, instrumentKey),
          gt(holdingLots.remainingQuantity, 0)
        )
      )
      .orderBy(asc(holdingLots.acquiredAt), asc(holdingLots.id))
      .for("update");

    // Existing accounts predate FIFO lots. Preserve their current cost basis as
    // one synthetic oldest lot, then use exact purchase lots from this point on.
    if (holding && lots.length === 0) {
      const [legacyLot] = await tx
        .insert(holdingLots)
        .values({
          userId,
          instrumentKey,
          remainingQuantity: holding.quantity,
          pricePaise: holding.avgPricePaise,
          acquiredAt: holding.updatedAt,
        })
        .returning({
          id: holdingLots.id,
          remainingQuantity: holdingLots.remainingQuantity,
          pricePaise: holdingLots.pricePaise,
        });
      lots = [legacyLot];
    }

    if (
      holding &&
      lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0) !== holding.quantity
    ) {
      throw new Error("Holding quantity does not match its FIFO purchase lots.");
    }

    if (side === "BUY") {
      if (wallet.balancePaise < totalPaise) {
        return reject(
          `Insufficient funds: order needs ₹${(totalPaise / 100).toLocaleString("en-IN")} but wallet has ₹${(wallet.balancePaise / 100).toLocaleString("en-IN")}.`
        );
      }

      const newBalance = wallet.balancePaise - totalPaise;
      await tx
        .update(wallets)
        .set({ balancePaise: newBalance, updatedAt: new Date() })
        .where(eq(wallets.userId, userId));

      if (holding) {
        const newQty = holding.quantity + quantity;
        const newAvg = calculateAveragePricePaise(
          holding.quantity,
          holding.avgPricePaise,
          quantity,
          pricePaise
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

      await tx.insert(holdingLots).values({
        userId,
        instrumentKey,
        remainingQuantity: quantity,
        pricePaise,
        // Set after row locks are acquired so concurrent orders retain true FIFO order.
        acquiredAt: new Date(),
      });

      const [order] = await tx
        .insert(orders)
        .values({ userId, instrumentKey, side, quantity, pricePaise, totalPaise, status: "FILLED" })
        .returning();
      return { order, balancePaise: newBalance };
    }

    // SELL
    if (!holding || holding.quantity < quantity) {
      return reject(
        `Insufficient shares: you hold ${holding?.quantity ?? 0} ${instrument.tradingSymbol}, tried to sell ${quantity}.`
      );
    }

    const fifo = consumeFifoLots(lots, quantity);
    const remaining = holding.quantity - quantity;
    if (fifo.remainingQuantity !== remaining) {
      throw new Error("FIFO result does not match the remaining holding quantity.");
    }

    for (const consumption of fifo.consumptions) {
      if (consumption.consumedQuantity === 0) continue;
      await tx
        .update(holdingLots)
        .set({ remainingQuantity: consumption.remainingQuantity })
        .where(eq(holdingLots.id, consumption.id));
    }

    if (remaining === 0) {
      await tx
        .delete(holdings)
        .where(and(eq(holdings.userId, userId), eq(holdings.instrumentKey, instrumentKey)));
    } else {
      await tx
        .update(holdings)
        .set({
          quantity: remaining,
          avgPricePaise: fifo.remainingAveragePricePaise!,
          updatedAt: new Date(),
        })
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
