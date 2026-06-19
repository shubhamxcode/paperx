import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  real,

  text,
  timestamp,
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
  exchange: text("exchange").notNull(),
  segment: text("segment").notNull(),
  instrumentType: text("instrumentType"),
  isin: text("isin"),
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

export type Instrument = typeof instruments.$inferSelect;
export type NewInstrument = typeof instruments.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;