import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "@auth/core/adapters";

// =============================================
// Auth.js Required Tables (for DrizzleAdapter)
// =============================================

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const upstoxTokens=pgTable("upstox_token",{
  id:text("id").primaryKey().$defaultFn(()=>crypto.randomUUID()),
  userId:text("userId").notNull().references(()=>users.id,{onDelete:"cascade"}).unique(),
  accessToken: text("accessToken").notNull(),
  expireAt:timestamp("expireAt",{mode:"date"}).notNull(),
  createdAt:timestamp("createdAt",{mode:"date"}).notNull().defaultNow(),
  updatedAt:timestamp("updatedAt",{mode:"date"}).notNull().defaultNow(),
})

// =============================================
// Upstox Instruments (mirrored from the daily master file)
// =============================================

export const instruments = pgTable("instrument", {
  // instrument_key is globally unique in the Upstox master file
  instrumentKey: text("instrumentKey").primaryKey(),
  tradingSymbol: text("tradingSymbol").notNull(),
  name: text("name"),
  shortName: text("shortName"),
  exchange: text("exchange").notNull(),
  segment: text("segment").notNull(),
  instrumentType: text("instrumentType"),
  isin: text("isin"),
  logoUrl: text("logoUrl"),
  logoSource: text("logoSource").$type<"BRANDFETCH">(),
  logoUpdatedAt: timestamp("logoUpdatedAt", { mode: "date" }),
  exchangeToken: text("exchangeToken"),
  lotSize: integer("lotSize"),
  tickSize: real("tickSize"),
  // F&O-only fields (null for equities/indices)
  expiry: timestamp("expiry", { mode: "date" }),
  strikePrice: real("strikePrice"),
  underlyingSymbol: text("underlyingSymbol"),
  assetSymbol: text("assetSymbol"),
  weekly: boolean("weekly"),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

// =============================================
// Paper Trading Engine
// All money is stored as integer paise (₹1 = 100 paise) — never floats.
// =============================================

/** Every user starts with ₹10,00,000 of virtual capital. */
export const STARTING_BALANCE_PAISE = 100_000_000;

export const wallets = pgTable("wallet", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balancePaise: bigint("balancePaise", { mode: "number" })
    .notNull()
    .default(STARTING_BALANCE_PAISE),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

// Product preferences only. We intentionally do not collect trading experience
// or suitability survey data; PaperX is designed for beginners by default.
export const userSettings = pgTable("user_setting", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  preferredExchange: text("preferredExchange")
    .$type<"NSE" | "BSE">()
    .notNull()
    .default("NSE"),
  chartInterval: text("chartInterval")
    .$type<"1m" | "5m" | "15m" | "1D">()
    .notNull()
    .default("5m"),
  defaultProduct: text("defaultProduct")
    .$type<"DELIVERY" | "INTRADAY">()
    .notNull()
    .default("DELIVERY"),
  orderConfirmation: boolean("orderConfirmation").notNull().default(true),
  orderUpdates: boolean("orderUpdates").notNull().default(true),
  marketAlerts: boolean("marketAlerts").notNull().default(false),
  learningReminders: boolean("learningReminders").notNull().default(true),
  compactMode: boolean("compactMode").notNull().default(false),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const holdings = pgTable(
  "holding",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    instrumentKey: text("instrumentKey")
      .notNull()
      .references(() => instruments.instrumentKey),
    quantity: integer("quantity").notNull(),
    // volume-weighted average buy price per share
    avgPricePaise: bigint("avgPricePaise", { mode: "number" }).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.instrumentKey] })]
);

export const orders = pgTable(
  "order",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    instrumentKey: text("instrumentKey")
      .notNull()
      .references(() => instruments.instrumentKey),
    side: text("side").$type<"BUY" | "SELL">().notNull(),
    quantity: integer("quantity").notNull(),
    // execution (or attempted) price per share at order time
    pricePaise: bigint("pricePaise", { mode: "number" }).notNull(),
    totalPaise: bigint("totalPaise", { mode: "number" }).notNull(),
    // rejected orders are kept as an audit trail
    status: text("status").$type<"FILLED" | "REJECTED">().notNull(),
    reason: text("reason"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("order_user_created_idx").on(t.userId, t.createdAt)]
);

// =============================================
// User Watchlists
// Persistent and account-owned; no user data is kept in browser storage.
// =============================================

export const watchlists = pgTable(
  "watchlist",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("My Watchlist"),
    isDefault: boolean("isDefault").notNull().default(true),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("watchlist_user_name_idx").on(t.userId, t.name),
    index("watchlist_user_idx").on(t.userId),
  ]
);

export const watchlistItems = pgTable(
  "watchlist_item",
  {
    watchlistId: text("watchlistId")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    instrumentKey: text("instrumentKey")
      .notNull()
      .references(() => instruments.instrumentKey),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.watchlistId, t.instrumentKey] }),
    index("watchlist_item_order_idx").on(t.watchlistId, t.sortOrder),
  ]
);

// =============================================
// AI Learning Tutor
// Conversations are private and cascade with the user. The model can read
// curated learning context, but no AI route has authority to mutate trades.
// =============================================

export const aiConversations = pgTable(
  "ai_conversation",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    instrumentKey: text("instrumentKey").references(() => instruments.instrumentKey),
    title: text("title").notNull().default("Stock learning session"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("ai_conversation_user_updated_idx").on(t.userId, t.updatedAt)]
);

export const aiMessages = pgTable(
  "ai_message",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversationId").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role").$type<"USER" | "ASSISTANT">().notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("ai_message_conversation_created_idx").on(t.conversationId, t.createdAt)]
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    feature: text("feature").$type<"CHAT" | "VISUAL_LESSON" | "QUIZ" | "TRADE_REVIEW">().notNull(),
    model: text("model").notNull(),
    inputTokens: integer("inputTokens").notNull().default(0),
    outputTokens: integer("outputTokens").notNull().default(0),
    latencyMs: integer("latencyMs").notNull().default(0),
    outcome: text("outcome").$type<"SUCCESS" | "REFUSED" | "ERROR">().notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_user_created_idx").on(t.userId, t.createdAt)]
);

export const learningProgress = pgTable(
  "learning_progress",
  {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    concept: text("concept").notNull(),
    attempts: integer("attempts").notNull().default(0),
    correctAnswers: integer("correctAnswers").notNull().default(0),
    mastery: integer("mastery").notNull().default(0),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.concept] })]
);

export const learningAttempts = pgTable(
  "learning_attempt",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    instrumentKey: text("instrumentKey").references(() => instruments.instrumentKey),
    concept: text("concept").notNull(),
    question: text("question").notNull(),
    selectedAnswer: integer("selectedAnswer").notNull(),
    correctAnswer: integer("correctAnswer").notNull(),
    correct: boolean("correct").notNull(),
    explanation: text("explanation").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("learning_attempt_user_created_idx").on(t.userId, t.createdAt)]
);

export type Wallet = typeof wallets.$inferSelect;
export type UserSetting = typeof userSettings.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Watchlist = typeof watchlists.$inferSelect;
export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type AiConversation = typeof aiConversations.$inferSelect;
export type AiMessage = typeof aiMessages.$inferSelect;
export type LearningProgress = typeof learningProgress.$inferSelect;

export type Instrument = typeof instruments.$inferSelect;
export type NewInstrument = typeof instruments.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
