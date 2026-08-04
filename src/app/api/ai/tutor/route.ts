import { getServerSession } from "next-auth";
import {
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  tool,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildTutorContext } from "@/lib/ai/context";
import { classifyTutorScope, getTutorGuard } from "@/lib/ai/intent";
import { paperxGoogle } from "@/lib/ai/provider";
import {
  ensureConversation,
  getConversationMessages,
  getLatestConversation,
  saveTutorMessage,
  saveUsage,
} from "@/lib/ai/persistence";
import { consumeTutorLimit } from "@/lib/ai/rate-limit";
import { soujiDrawingSchema, tutorRequestSchema } from "@/lib/ai/schemas";
import { prohibitedLearningRequest, sanitizeOverlays, TUTOR_INSTRUCTIONS } from "@/lib/ai/safety";
import { serverEnv } from "@/lib/env/server";

export const maxDuration = 60;

type SoujiMetadata = {
  conversationId?: string;
  model?: string;
  createdAt?: number;
  totalTokens?: number;
};

export type SoujiMessage = UIMessage<SoujiMetadata>;

function messageText(message: UIMessage | undefined) {
  return message?.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim() ?? "";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const instrumentKey = new URL(request.url).searchParams.get("instrumentKey")?.trim();
  if (!instrumentKey) return Response.json({ error: "instrumentKey is required" }, { status: 400 });

  const conversation = await getLatestConversation(session.user.id, instrumentKey);
  if (!conversation) return Response.json({ conversationId: null, messages: [] });
  const messages = await getConversationMessages(conversation.id);
  return Response.json({
    conversationId: conversation.id,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: [{ type: "text", text: message.content }],
      metadata: { createdAt: message.createdAt.getTime() },
    })),
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    messages?: UIMessage[];
    instrumentKey?: string;
    range?: string;
    interval?: string;
    conversationId?: string;
    live?: boolean;
    deepAnalysis?: boolean;
    chartImages?: string[];
  } | null;
  const incomingMessage = body?.messages?.at(-1);
  const question = messageText(incomingMessage);
  const parsed = tutorRequestSchema.safeParse({ ...body, question });
  if (!parsed.success) return Response.json({ error: "Invalid tutor request", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const limit = consumeTutorLimit(session.user.id);
  if (!limit.allowed) return Response.json({ error: "Souji needs a short pause. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  if (prohibitedLearningRequest(input.question)) {
    await saveUsage({ userId: session.user.id, feature: "SOUJI", model: serverEnv.geminiModel, latencyMs: Date.now() - startedAt, outcome: "REFUSED" });
    return Response.json({ error: "Souji can analyze and explain, but cannot reveal secrets or execute trades." }, { status: 400 });
  }

  try {
    const guard = getTutorGuard(input);
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
    const history = await getConversationMessages(conversation.id);
    await saveTutorMessage(conversation.id, "USER", input.question);
    const visionNote = input.chartImages?.length
      ? `\n\nLIVE CHART FRAME\nThe attached image is the newest PaperX chart frame.${input.deepAnalysis ? " Perform a thorough visual and OHLCV analysis." : ""} Use pixels for visual structure and supplied OHLCV for exact values. If they disagree, trust OHLCV and state the limitation.`
      : "\n\nLIVE CHART FRAME\nNo frame was supplied. Do not claim to see the chart.";
    const guardNote = guard ? `\n\nVISIBLE-CHART MISMATCH\n${guard.message}` : "";
    const currentRequest = `PAPERX CONTEXT\n${JSON.stringify(context)}${visionNote}${guardNote}\n\nCURRENT LEARNER REQUEST\n${input.question}`;
    const currentContent = input.chartImages?.length
      ? [
          { type: "text" as const, text: currentRequest },
          ...input.chartImages.map((image) => ({ type: "image" as const, image })),
        ]
      : currentRequest;
    const messages: ModelMessage[] = [
      ...history.map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: currentContent },
    ];
    const google = paperxGoogle();
    const result = streamText({
      model: google(serverEnv.geminiModel),
      instructions: TUTOR_INSTRUCTIONS,
      messages,
      tools: {
        google_search: google.tools.googleSearch({}),
        drawChart: tool({
          description: "Draw evidence-backed levels, zones, or candle markers on the currently visible PaperX chart. Use this whenever a drawing would make a chart explanation clearer.",
          inputSchema: soujiDrawingSchema,
          execute: async ({ overlays, explanation }) => ({
            overlays: sanitizeOverlays(overlays, candles),
            explanation,
          }),
        }),
      },
      stopWhen: stepCountIs(3),
      abortSignal: request.signal,
      maxOutputTokens: scope === "CASUAL" ? 500 : input.deepAnalysis ? 5000 : scope === "GENERAL" ? 2200 : 3600,
      providerOptions: {
        google: { thinkingConfig: { thinkingLevel: scope === "CASUAL" ? "minimal" : input.deepAnalysis ? "high" : "medium" } },
      },
      onFinish: async ({ text, usage }) => {
        await Promise.all([
          text.trim() ? saveTutorMessage(conversation.id, "ASSISTANT", text) : Promise.resolve(),
          saveUsage({
            userId: session.user.id,
            feature: "SOUJI",
            model: serverEnv.geminiModel,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            latencyMs: Date.now() - startedAt,
            outcome: "SUCCESS",
          }),
        ]);
      },
    });
    result.consumeStream();
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        sendSources: true,
        messageMetadata: ({ part }) => {
          if (part.type === "start") {
            return { conversationId: conversation.id, model: serverEnv.geminiModel, createdAt: Date.now() };
          }
          if (part.type === "finish") {
            return { conversationId: conversation.id, totalTokens: part.totalUsage.totalTokens };
          }
        },
        onError: () => "Souji lost the connection while thinking. Please try again.",
      }),
    });
  } catch (error) {
    console.error("Souji failed:", error);
    await saveUsage({ userId: session.user.id, feature: "SOUJI", model: serverEnv.geminiModel, latencyMs: Date.now() - startedAt, outcome: "ERROR" }).catch(() => undefined);
    return Response.json({
      error: "Souji is unavailable right now. Your chart and paper account were not changed.",
      ...(process.env.NODE_ENV === "development" ? { detail: error instanceof Error ? error.message : String(error) } : {}),
    }, { status: 500 });
  }
}
