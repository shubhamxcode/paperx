import { getServerSession } from "next-auth";
import {
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  tool,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from "ai";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildTutorContext } from "@/lib/ai/context";
import { classifyTutorScope, getTutorGuard } from "@/lib/ai/intent";
import { paperxGoogle } from "@/lib/ai/provider";
import {
  ConversationScopeError,
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
import { MarketDataUnavailableError } from "@/lib/upstox/client";

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

  const searchParams = new URL(request.url).searchParams;
  const surface = searchParams.get("surface");
  const requestedInstrument = searchParams.get("instrumentKey")?.trim() || null;
  if (surface !== "stock" && surface !== "portfolio") {
    return Response.json({ error: "A valid surface is required" }, { status: 400 });
  }
  if (surface === "stock" && !requestedInstrument) {
    return Response.json({ error: "instrumentKey is required" }, { status: 400 });
  }
  if (surface === "portfolio" && requestedInstrument) {
    return Response.json(
      { error: "Portfolio conversations cannot use an instrumentKey" },
      { status: 400 }
    );
  }
  const instrumentKey = surface === "stock" ? requestedInstrument : null;

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
    surface?: string;
    instrumentKey?: string | null;
    range?: string;
    interval?: string;
    conversationId?: string;
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
    const scope = classifyTutorScope(input);
    const hasStockContext = scope === "STOCK" || scope === "COMBINED";
    const guard = hasStockContext ? getTutorGuard(input) : null;
    const { context, candles } =
      scope === "STOCK" || scope === "PORTFOLIO" || scope === "COMBINED"
      ? await buildTutorContext(session.user.id, input, scope)
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
    const conversationInstrument =
      input.surface === "stock" ? input.instrumentKey ?? null : null;
    const conversation = await ensureConversation(
      session.user.id,
      conversationInstrument,
      input.conversationId
    );
    const history = await getConversationMessages(conversation.id);
    await saveTutorMessage(conversation.id, "USER", input.question);
    const visionNote = input.chartImages?.length
      ? "\n\nVISIBLE CHART FRAME\nThe attached image is a one-time capture of the learner's visible PaperX chart viewport, so horizontally hidden candles may not appear in it. Analyze chart.ohlcv for the whole selected range and use the image for visible structure. If they disagree, trust OHLCV and state the limitation."
      : hasStockContext
        ? "\n\nVISIBLE CHART FRAME\nNo frame was supplied for this question. Do not claim to see the chart."
        : "";
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
    let tools: ToolSet = {
      google_search: google.tools.googleSearch({}),
    };
    if (hasStockContext) {
      tools = {
        ...tools,
        drawChart: tool({
          description: "Draw evidence-backed levels, zones, or candle markers on the current stock's selected PaperX chart. Every value must be grounded in PAPERX CONTEXT for this turn.",
          inputSchema: soujiDrawingSchema,
          execute: async ({ overlays, explanation }) => ({
            overlays: sanitizeOverlays(overlays, candles),
            explanation,
          }),
        }),
      };
    }
    const result = streamText({
      model: google(serverEnv.geminiModel),
      instructions: TUTOR_INSTRUCTIONS,
      messages,
      tools,
      stopWhen: stepCountIs(3),
      abortSignal: request.signal,
      maxOutputTokens:
        scope === "CASUAL" ? 500 : scope === "GENERAL" ? 2200 : 4000,
      providerOptions: {
        google: { thinkingConfig: { thinkingLevel: scope === "CASUAL" ? "minimal" : "medium" } },
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
    if (error instanceof MarketDataUnavailableError) {
      return Response.json({
        error: "Souji cannot verify this stock right now because live market data is temporarily unavailable. Please try again shortly.",
        marketDataUnavailable: true,
      }, { status: 503 });
    }
    if (error instanceof ConversationScopeError) {
      return Response.json(
        { error: "This conversation does not match the current Souji scope." },
        { status: 409 }
      );
    }
    return Response.json({
      error: "Souji is unavailable right now. Your chart and paper account were not changed.",
      ...(process.env.NODE_ENV === "development" ? { detail: error instanceof Error ? error.message : String(error) } : {}),
    }, { status: 500 });
  }
}
