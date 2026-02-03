import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  boolean,
  numeric,
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

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ]
);

// Optional: Authenticators table for WebAuthn (passkeys)
export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => [
    primaryKey({
      columns: [authenticator.userId, authenticator.credentialID],
    }),
  ]
);

// =============================================
// Custom User Profile Table
// =============================================

export const userProfiles = pgTable("user_profile", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("displayName"),
  bio: text("bio"),
  phone: text("phone"),
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

// =============================================
// App Tables (Paper Trading)
// =============================================

export const portfolios = pgTable("portfolio", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").default("Main Portfolio").notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 })
    .default("100000.00")
    .notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const trades = pgTable("trade", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  portfolioId: text("portfolioId")
    .notNull()
    .references(() => portfolios.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  type: text("type").$type<"buy" | "sell">().notNull(),
  quantity: integer("quantity").notNull(),
  price: numeric("price", { precision: 15, scale: 2 }).notNull(),
  executedAt: timestamp("executedAt", { mode: "date" }).defaultNow().notNull(),
});

export const holdings = pgTable("holding", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  portfolioId: text("portfolioId")
    .notNull()
    .references(() => portfolios.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  quantity: integer("quantity").notNull(),
  averageCost: numeric("averageCost", { precision: 15, scale: 2 }).notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

// =============================================
// Type Exports (for use in app)
// =============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type Portfolio = typeof portfolios.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
