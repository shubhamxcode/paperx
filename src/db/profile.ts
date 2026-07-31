import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const PROFILE_SETTING_OPTIONS = {
  preferredExchange: ["NSE", "BSE"],
  chartInterval: ["1m", "5m", "15m", "1D"],
  defaultProduct: ["DELIVERY", "INTRADAY"],
} as const;

export type ProfileSettingsUpdate = {
  preferredExchange: "NSE" | "BSE";
  chartInterval: "1m" | "5m" | "15m" | "1D";
  defaultProduct: "DELIVERY" | "INTRADAY";
  orderConfirmation: boolean;
  orderUpdates: boolean;
  marketAlerts: boolean;
  learningReminders: boolean;
  compactMode: boolean;
};

export async function ensureUserSettings(userId: string) {
  await db.insert(userSettings).values({ userId }).onConflictDoNothing();
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  if (!settings) throw new Error("Unable to initialize user settings");
  return settings;
}

export async function updateUserSettings(
  userId: string,
  values: ProfileSettingsUpdate
) {
  await ensureUserSettings(userId);
  const [settings] = await db
    .update(userSettings)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId))
    .returning();
  return settings;
}
