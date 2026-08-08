import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { aiConversations, aiMessages, aiUsage } from "@/db/schema";
import { isConversationInScope } from "@/lib/ai/conversation-scope";

export class ConversationScopeError extends Error {
  constructor() {
    super("Conversation does not belong to this user and scope.");
    this.name = "ConversationScopeError";
  }
}

function conversationScope(instrumentKey: string | null) {
  return instrumentKey === null
    ? isNull(aiConversations.instrumentKey)
    : eq(aiConversations.instrumentKey, instrumentKey);
}

export async function ensureConversation(
  userId: string,
  instrumentKey: string | null,
  conversationId?: string
) {
  if (conversationId) {
    const [existing] = await db.select().from(aiConversations).where(and(
      eq(aiConversations.id, conversationId),
      eq(aiConversations.userId, userId),
    ));
    if (
      existing &&
      isConversationInScope(existing.instrumentKey, instrumentKey)
    ) {
      return existing;
    }
    throw new ConversationScopeError();
  }
  const [created] = await db.insert(aiConversations).values({
    userId,
    instrumentKey,
    title: instrumentKey ? "Stock learning session" : "Portfolio coaching session",
  }).returning();
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

export async function getLatestConversation(
  userId: string,
  instrumentKey: string | null
) {
  const [conversation] = await db.select().from(aiConversations).where(and(
    eq(aiConversations.userId, userId),
    conversationScope(instrumentKey),
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
