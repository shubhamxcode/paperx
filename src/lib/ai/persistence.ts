import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiConversations, aiMessages, aiUsage, learningAttempts, learningProgress } from "@/db/schema";

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

export async function saveTutorExchange(conversationId: string, question: string, answer: string) {
  await db.transaction(async (tx) => {
    await tx.insert(aiMessages).values([
      { conversationId, role: "USER", content: question },
      { conversationId, role: "ASSISTANT", content: answer },
    ]);
    await tx.update(aiConversations).set({ updatedAt: new Date(), title: question.slice(0, 80) }).where(eq(aiConversations.id, conversationId));
  });
}

export async function getRecentConversationMessages(conversationId: string) {
  const rows = await db.select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(12);
  return rows.reverse().map((message) => ({
    role: message.role === "USER" ? "user" as const : "assistant" as const,
    content: message.content,
  }));
}

export async function saveUsage(input: {
  userId: string;
  feature: "CHAT" | "VISUAL_LESSON" | "QUIZ" | "TRADE_REVIEW";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  outcome: "SUCCESS" | "REFUSED" | "ERROR";
}) {
  await db.insert(aiUsage).values({ ...input, inputTokens: input.inputTokens ?? 0, outputTokens: input.outputTokens ?? 0 });
}

export async function recordQuizAttempt(input: {
  userId: string;
  instrumentKey: string;
  concept: string;
  question: string;
  selectedAnswer: number;
  correctAnswer: number;
  explanation: string;
}) {
  const correct = input.selectedAnswer === input.correctAnswer;
  await db.transaction(async (tx) => {
    await tx.insert(learningAttempts).values({ ...input, correct });
    await tx.insert(learningProgress).values({
      userId: input.userId,
      concept: input.concept,
      attempts: 1,
      correctAnswers: correct ? 1 : 0,
      mastery: correct ? 20 : 5,
    }).onConflictDoUpdate({
      target: [learningProgress.userId, learningProgress.concept],
      set: {
        attempts: sql`${learningProgress.attempts} + 1`,
        correctAnswers: sql`${learningProgress.correctAnswers} + ${correct ? 1 : 0}`,
        mastery: sql`LEAST(100, ${learningProgress.mastery} + ${correct ? 20 : 5})`,
        updatedAt: new Date(),
      },
    });
  });
}

export async function getLearningSummary(userId: string) {
  const [progress, conversations] = await Promise.all([
    db.select().from(learningProgress).where(eq(learningProgress.userId, userId)).orderBy(desc(learningProgress.updatedAt)).limit(12),
    db.select({ id: aiConversations.id, title: aiConversations.title, instrumentKey: aiConversations.instrumentKey, updatedAt: aiConversations.updatedAt })
      .from(aiConversations).where(eq(aiConversations.userId, userId)).orderBy(desc(aiConversations.updatedAt)).limit(8),
  ]);
  return { progress, conversations };
}
