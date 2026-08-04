import { getServerSession } from "next-auth";
import { generateText, Output, streamText } from "ai";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildTutorContext } from "@/lib/ai/context";
import { classifyTutorScope, getTutorGuard } from "@/lib/ai/intent";
import { paperxGeminiModel } from "@/lib/ai/provider";
import { ensureConversation, getRecentConversationMessages, saveTutorExchange, saveUsage } from "@/lib/ai/persistence";
import { consumeTutorLimit } from "@/lib/ai/rate-limit";
import { learningOutputSchema, tutorRequestSchema } from "@/lib/ai/schemas";
import { prohibitedLearningRequest, sanitizeOverlays, TUTOR_INSTRUCTIONS } from "@/lib/ai/safety";
import { serverEnv } from "@/lib/env/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = tutorRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid tutor request", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const limit = consumeTutorLimit(session.user.id);
  if (!limit.allowed) return Response.json({ error: "Tutor limit reached. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  if (prohibitedLearningRequest(input.question)) {
    await saveUsage({ userId: session.user.id, feature: input.mode, model: serverEnv.geminiModel, latencyMs: Date.now() - startedAt, outcome: "REFUSED" });
    return Response.json({ error: "PaperX Tutor teaches market concepts, but cannot give guaranteed tips, reveal secrets, or execute trades." }, { status: 400 });
  }

  try {
    const guard = getTutorGuard(input);
    if (guard) {
      const conversation = await ensureConversation(session.user.id, input.instrumentKey, input.conversationId);
      await Promise.all([
        saveTutorExchange(conversation.id, input.question, guard.message),
        saveUsage({ userId: session.user.id, feature: input.mode, model: "paperx-context-guard", latencyMs: Date.now() - startedAt, outcome: "SUCCESS" }),
      ]);
      if (input.mode === "CHAT") {
        return new Response(guard.message, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "X-PaperX-Conversation": conversation.id },
        });
      }
      return Response.json({
        conversationId: conversation.id,
        answer: guard.message,
        factsUsed: guard.code === "INTERVAL_MISMATCH" ? [
          { label: "Visible interval", value: guard.visibleInterval },
          { label: "Requested interval", value: guard.requestedInterval },
        ] : [
          { label: "Visible range", value: guard.visibleRange },
          { label: "Requested range", value: guard.requestedRange },
        ],
        overlays: [],
        quiz: null,
        followUps: [],
      });
    }

    const scope = classifyTutorScope(input);
    const { context, candles } = scope === "STOCK"
      ? await buildTutorContext(session.user.id, input)
      : {
          context: {
            scope,
            note: scope === "CASUAL"
              ? "No market data is needed for this casual conversation."
              : "Answer from established educational knowledge. Do not make claims about the currently open stock because no live market snapshot was loaded.",
            boundaries: { educationalOnly: true, mayExecuteOrders: false },
          },
          candles: [],
        };
    const conversation = await ensureConversation(session.user.id, input.instrumentKey, input.conversationId);
    const history = await getRecentConversationMessages(conversation.id);
    const modeGuidance = {
      CHAT: "Respond conversationally to the learner's exact intent. For a chart question, explain the evidence and reasoning in useful depth; for a small follow-up doubt, answer directly without repeating the whole lesson.",
      VISUAL_LESSON: "Teach the part of the visible chart the learner actually asked about. Explain how to read the marked evidence, why it matters, and its limitations. If their requested interval differs from the visible interval, say so before teaching. Include a short knowledge-check only when it reinforces the answer.",
      QUIZ: "Create one unambiguous beginner quiz grounded in the supplied chart. Make distractors plausible and explain why the correct option is right.",
      TRADE_REVIEW: "Review only the selected paper trade. Separate the decision process from the later outcome, identify one strength and one improvement, and avoid hindsight certainty.",
    }[input.mode];
    const visionNote = input.chartImages?.length
      ? `\n\nCHART IMAGES\nImage 1 is the full chart currently rendered in PaperX.${input.chartImages.length > 1 ? " Image 2 is a temporary close-up of approximately the latest 45 candles." : ""} Use images to understand visual structure and the supplied OHLCV data for exact values. If pixels and data appear to disagree, trust the OHLCV data and mention the limitation.`
      : "\n\nCHART IMAGES\nNo chart screenshot was available. Use only the supplied OHLCV context and do not claim to see visual details.";
    const currentRequest = `PAPERX CONTEXT\n${JSON.stringify(context)}\n\nMODE GUIDANCE\n${modeGuidance}${visionNote}\n\nCURRENT LEARNER REQUEST\n${input.question}`;
    const currentContent = input.chartImages?.length
      ? [
          { type: "text" as const, text: currentRequest },
          ...input.chartImages.map((image) => ({ type: "image" as const, image })),
        ]
      : currentRequest;
    const messages = [...history, { role: "user" as const, content: currentContent }];

    if (input.mode === "CHAT") {
      const result = streamText({
        model: paperxGeminiModel(),
        instructions: TUTOR_INSTRUCTIONS,
        messages,
        abortSignal: request.signal,
        maxOutputTokens: scope === "CASUAL" ? 500 : scope === "GENERAL" ? 1800 : 3400,
        providerOptions: {
          google: { thinkingConfig: { thinkingLevel: scope === "CASUAL" ? "minimal" : "low" } },
        },
        onEnd: async ({ text, usage }) => {
          await Promise.all([
            saveTutorExchange(conversation.id, input.question, text),
            saveUsage({ userId: session.user.id, feature: input.mode, model: serverEnv.geminiModel, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, latencyMs: Date.now() - startedAt, outcome: "SUCCESS" }),
          ]);
        },
      });
      return result.toTextStreamResponse({ headers: { "X-PaperX-Conversation": conversation.id } });
    }

    const result = await generateText({
      model: paperxGeminiModel(),
      instructions: `${TUTOR_INSTRUCTIONS}\nReturn a structured learning response. Use overlays only when supported by visible candles. For VISUAL_LESSON include at least one useful overlay. For QUIZ include exactly one quiz; otherwise quiz may be null.`,
      messages,
      output: Output.object({ schema: learningOutputSchema }),
      maxOutputTokens: 4500,
      providerOptions: {
        google: { thinkingConfig: { thinkingLevel: "medium" } },
      },
      abortSignal: request.signal,
    });
    const validatedOverlays = sanitizeOverlays(result.output.overlays, candles);
    const fallbackOverlays = input.mode === "VISUAL_LESSON" && validatedOverlays.length === 0 && candles.length > 0
      ? [
          { type: "horizontal-line" as const, label: "Visible high", price: Math.max(...candles.map((item) => item.high)), from: null, to: null, time: null, tone: "warning" as const },
          { type: "horizontal-line" as const, label: "Visible low", price: Math.min(...candles.map((item) => item.low)), from: null, to: null, time: null, tone: "info" as const },
        ]
      : [];
    const output = { ...result.output, overlays: validatedOverlays.length > 0 ? validatedOverlays : fallbackOverlays };
    await Promise.all([
      saveTutorExchange(conversation.id, input.question, output.answer),
      saveUsage({ userId: session.user.id, feature: input.mode, model: serverEnv.geminiModel, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, latencyMs: Date.now() - startedAt, outcome: "SUCCESS" }),
    ]);
    return Response.json({ conversationId: conversation.id, ...output });
  } catch (error) {
    console.error("PaperX tutor failed:", error);
    await saveUsage({ userId: session.user.id, feature: input.mode, model: serverEnv.geminiModel, latencyMs: Date.now() - startedAt, outcome: "ERROR" }).catch(() => undefined);
    return Response.json({
      error: "The tutor is unavailable right now. Your chart and trading data were not changed.",
      ...(process.env.NODE_ENV === "development" ? { detail: error instanceof Error ? error.message : String(error) } : {}),
    }, { status: 500 });
  }
}
