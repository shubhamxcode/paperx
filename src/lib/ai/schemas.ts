import { z } from "zod";

export const tutorRequestSchema = z
  .object({
    surface: z.enum(["stock", "portfolio"]),
    instrumentKey: z.string().trim().min(1).max(128).nullable().optional(),
    question: z.string().trim().min(2).max(800),
    range: z.enum(["1D", "1W", "1M", "3M", "1Y", "5Y"]).default("1D"),
    interval: z.enum(["1m", "5m", "15m", "30m", "1h"]).default("5m"),
    conversationId: z.string().uuid().optional(),
    chartImages: z.array(
      z.string()
        .regex(/^data:image\/(?:png|jpeg|webp);base64,/)
        .max(1_500_000)
    ).max(2).optional(),
  })
  .superRefine((input, context) => {
    if (input.surface === "stock" && !input.instrumentKey) {
      context.addIssue({
        code: "custom",
        path: ["instrumentKey"],
        message: "Stock conversations require an instrument key.",
      });
    }
    if (input.surface === "portfolio" && input.instrumentKey) {
      context.addIssue({
        code: "custom",
        path: ["instrumentKey"],
        message: "Portfolio conversations cannot be tied to an instrument.",
      });
    }
    if (input.surface === "portfolio" && input.chartImages?.length) {
      context.addIssue({
        code: "custom",
        path: ["chartImages"],
        message: "Portfolio conversations do not accept chart images.",
      });
    }
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

export const soujiDrawingSchema = z.object({
  overlays: z.array(overlaySchema).min(1).max(6),
  explanation: z.string().min(2).max(240),
});

export type TutorRequest = z.infer<typeof tutorRequestSchema>;
export type SoujiDrawing = z.infer<typeof soujiDrawingSchema>;
