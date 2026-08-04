import { z } from "zod";

export const tutorRequestSchema = z.object({
  instrumentKey: z.string().trim().min(1).max(128),
  question: z.string().trim().min(2).max(800),
  mode: z.enum(["CHAT", "VISUAL_LESSON", "QUIZ", "TRADE_REVIEW"]).default("CHAT"),
  range: z.enum(["1D", "1W", "1M", "3M", "1Y", "5Y"]).default("1D"),
  interval: z.enum(["1m", "5m", "15m", "30m", "1h"]).default("5m"),
  orderId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  chartImages: z.array(z.string().startsWith("data:image/png;base64,").max(1_500_000)).max(2).optional(),
});

export const overlaySchema = z.object({
  type: z.enum(["horizontal-line", "range-zone", "candle-marker"]),
  label: z.string().min(1).max(60),
  price: z.number().positive().nullable(),
  from: z.number().positive().nullable(),
  to: z.number().positive().nullable(),
  time: z.number().int().positive().nullable(),
  tone: z.enum(["info", "positive", "warning"]),
});

export const quizSchema = z.object({
  concept: z.string().min(2).max(60),
  question: z.string().min(5).max(240),
  options: z.array(z.string().min(1).max(140)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().min(5).max(500),
});

export const learningOutputSchema = z.object({
  answer: z.string().min(10).max(3500),
  factsUsed: z.array(z.object({ label: z.string().max(60), value: z.string().max(120) })).max(8),
  overlays: z.array(overlaySchema).max(5),
  quiz: quizSchema.nullable(),
  followUps: z.array(z.string().min(2).max(120)).max(3),
});

export type LearningOutput = z.infer<typeof learningOutputSchema>;
export type TutorRequest = z.infer<typeof tutorRequestSchema>;
