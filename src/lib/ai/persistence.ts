import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiConversations, aiMessages, aiUsage } from "@/db/schema";

export async function ensureConversation(userId: string, instrumentKey: string, conversationId?: string) {
  if (conversationId) {
    const [existing] = await db.select().from(aiConversations).where(and(
      eq(aiConversations.id, conversationId),
      eq(aiConversations.userId, userId),
      eq(aiConversations.instrumentKey, instrumentKey),
    ));
    if (existing) return existing;
  }
  const [created] = await db.insert(aiConversations).values({ userId, instrumentKey }).returning();
  return created;
}

export async function saveTutorMessage(
  conversationId: string,
  role: "USER" | "ASSISTANT",
  content: string
) {
  const [message] = await db.insert(aiMessages).values({ conversationId, role, content }).returning();
  await db.update(aiConversations).set({
    updatedAt: new Date(),
    ...(role === "USER" ? { title: content.slice(0, 80) } : {}),
  }).where(eq(aiConversations.id, conversationId));
  return message;
}

export async function getConversationMessages(conversationId: string) {
  const rows = await db.select({
    id: aiMessages.id,
    role: aiMessages.role,
    content: aiMessages.content,
    createdAt: aiMessages.createdAt,
  })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(aiMessages.createdAt);
  return rows.map((message) => ({
    id: message.id,
    role: message.role === "USER" ? "user" as const : "assistant" as const,
    content: message.content,
    createdAt: message.createdAt,
  }));
}

export async function getLatestConversation(userId: string, instrumentKey: string) {
  const [conversation] = await db.select().from(aiConversations).where(and(
    eq(aiConversations.userId, userId),
    eq(aiConversations.instrumentKey, instrumentKey),
  )).orderBy(desc(aiConversations.updatedAt)).limit(1);
  return conversation ?? null;
}

export async function saveUsage(input: {
  userId: string;
  feature: "SOUJI";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  outcome: "SUCCESS" | "REFUSED" | "ERROR";
}) {
  await db.insert(aiUsage).values({ ...input, inputTokens: input.inputTokens ?? 0, outputTokens: input.outputTokens ?? 0 });
}
