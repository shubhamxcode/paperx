"use client";

import { useChat } from "@ai-sdk/react";
import {
  Activity,
  ChevronDown,
  Eraser,
  Maximize2,
  Radio,
  RotateCcw,
  Send,
  Square,
  X,
} from "lucide-react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import type { LearningOverlay } from "@/components/stocks/StockChart";

type SoujiMetadata = {
  conversationId?: string;
  model?: string;
  createdAt?: number;
  totalTokens?: number;
};

type DrawingOutput = {
  overlays: LearningOverlay[];
  explanation: string;
};

type SoujiTools = {
  drawChart: {
    input: DrawingOutput;
    output: DrawingOutput;
  };
};

type SoujiMessage = UIMessage<SoujiMetadata, never, SoujiTools>;

const CHART_QUESTION = /\b(?:this|current|visible|live|chart|candle|price|volume|trend|support|resistance|pattern|intraday|bullish|bearish|breakout)\b/i;

const markdownComponents: Components = {
  h1: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold leading-6 text-white first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold leading-6 text-white first:mt-0">{children}</h3>,
  h3: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold leading-6 text-white first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="mb-3 max-w-[70ch] text-[0.9375rem] leading-7 !text-slate-200 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold !text-white">{children}</strong>,
  em: ({ children }) => <em className="!text-slate-100">{children}</em>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1.5 pl-5 text-slate-200 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-slate-200 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-1 leading-7 marker:text-cyan-300">{children}</li>,
  blockquote: ({ children }) => <blockquote className="my-3 rounded-xl bg-white/[0.055] px-4 py-3 text-slate-100">{children}</blockquote>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-cyan-300 underline decoration-cyan-300/40 underline-offset-2 hover:text-cyan-200">{children}</a>,
  code: ({ className, children }) => className
    ? <code className={`${className} my-3 block max-w-full overflow-x-auto rounded-xl bg-black/35 p-3 text-sm leading-6 text-slate-100`}>{children}</code>
    : <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[0.875rem] text-cyan-100">{children}</code>,
};

function isDrawingOutput(value: unknown): value is DrawingOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Partial<DrawingOutput>;
  return Array.isArray(output.overlays) && typeof output.explanation === "string";
}

function messageText(message: SoujiMessage) {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function SoujiAssistant({
  instrumentKey,
  symbol,
  range,
  interval,
  captureChartFrame,
  onOverlays,
}: {
  instrumentKey: string;
  symbol: string;
  range: string;
  interval: string;
  captureChartFrame?: () => string | null;
  onOverlays: (overlays: LearningOverlay[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [deepAnalysis, setDeepAnalysis] = useState(false);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [frameReady, setFrameReady] = useState(false);
  const liveFrameRef = useRef<string | undefined>(undefined);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/ai/tutor" }), []);
  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    stop,
  } = useChat<SoujiMessage>({
    id: conversationId ?? `souji-${instrumentKey}`,
    transport,
    throttle: 50,
    onFinish: ({ message }) => {
      if (message.metadata?.conversationId) setConversationId(message.metadata.conversationId);
    },
  });
  const busy = status === "submitted" || status === "streaming";

  const refreshLiveFrame = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    const frame = captureChartFrame?.();
    if (!frame) return;
    liveFrameRef.current = frame;
    setFrameReady(true);
  }, [captureChartFrame]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ai/tutor?instrumentKey=${encodeURIComponent(instrumentKey)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((body) => {
        if (cancelled || !body) return;
        setConversationId(body.conversationId ?? undefined);
        setMessages(body.messages ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [instrumentKey, setMessages]);

  useEffect(() => {
    if (!live) {
      liveFrameRef.current = undefined;
      return;
    }
    const timer = window.setInterval(refreshLiveFrame, 4_000);
    return () => window.clearInterval(timer);
  }, [live, refreshLiveFrame]);

  useEffect(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type !== "tool-drawChart" || part.state !== "output-available") continue;
        if (isDrawingOutput(part.output)) onOverlays(part.output.overlays);
      }
    }
  }, [messages, onOverlays]);

  useEffect(() => {
    if (!open) return;
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status, open]);

  const submit = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");

    const needsFrame = live || deepAnalysis || CHART_QUESTION.test(text);
    const frame = needsFrame
      ? liveFrameRef.current ?? captureChartFrame?.() ?? undefined
      : undefined;

    try {
      await sendMessage(
        { text },
        {
          body: {
            instrumentKey,
            range,
            interval,
            conversationId,
            live,
            deepAnalysis,
            chartImages: frame ? [frame] : [],
          },
        }
      );
      setDeepAnalysis(false);
    } catch {
      setInput(text);
    }
  };

  const newConversation = () => {
    stop();
    setConversationId(undefined);
    setMessages([]);
    onOverlays([]);
    setInput("");
    inputRef.current?.focus();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex min-h-12 items-center gap-2 rounded-full border border-cyan-300/25 bg-[#0b0d10] px-4 text-sm font-semibold text-white shadow-2xl shadow-black/40 transition hover:border-cyan-300/50 hover:bg-[#111820] max-sm:bottom-4 max-sm:right-4"
        aria-label="Open Souji"
      >
        <span className="relative h-8 w-8 shrink-0">
          <span className="absolute inset-0 overflow-hidden rounded-full ring-1 ring-cyan-300/40">
            <Image src="/souji logo.jpeg" alt="" fill sizes="32px" className="object-cover" />
          </span>
          {live && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0b0d10]" />}
        </span>
        Souji
      </button>
    );
  }

  return (
    <section
      className="fixed bottom-5 right-5 z-50 flex h-[min(620px,78dvh)] w-[390px] min-h-[420px] min-w-[340px] max-w-[min(680px,calc(100vw-2rem))] resize flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0b0d10] shadow-2xl shadow-black/60 max-sm:inset-x-0 max-sm:bottom-0 max-sm:h-[72dvh] max-sm:min-h-0 max-sm:w-full max-sm:min-w-0 max-sm:max-w-none max-sm:resize-none max-sm:rounded-b-none"
      aria-label="Souji AI assistant"
    >
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-white/10 px-3">
        <span className="relative h-10 w-10 shrink-0">
          <span className="absolute inset-0 overflow-hidden rounded-xl ring-1 ring-cyan-300/35">
            <Image src="/souji logo.jpeg" alt="Souji AI" fill sizes="40px" className="object-cover" priority />
          </span>
          {live && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0b0d10]" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-white">Souji</h2>
          <p className="truncate text-xs text-slate-400">
            {live ? `Live with ${symbol} · ${range} ${interval}` : "Your market friend"}
          </p>
        </div>
        <button type="button" onClick={newConversation} className="paperx-icon-button" title="New conversation" aria-label="Start new Souji conversation">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setOpen(false)} className="paperx-icon-button" title="Minimize" aria-label="Minimize Souji">
          <ChevronDown className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => { setOpen(false); setLive(false); }} className="paperx-icon-button" title="Close" aria-label="Close Souji">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <button
          type="button"
          onClick={() => {
            if (live) {
              liveFrameRef.current = undefined;
              setFrameReady(false);
              setLive(false);
            } else {
              setLive(true);
              window.requestAnimationFrame(refreshLiveFrame);
            }
          }}
          aria-pressed={live}
          className={`flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition ${
            live ? "bg-emerald-400/12 text-emerald-300 ring-1 ring-emerald-300/25" : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]"
          }`}
        >
          <Radio className={`h-3.5 w-3.5 ${live ? "animate-pulse motion-reduce:animate-none" : ""}`} />
          {live ? "Live vision on" : "Go Live"}
        </button>
        <button
          type="button"
          onClick={() => setDeepAnalysis((value) => !value)}
          aria-pressed={deepAnalysis}
          className={`flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium transition ${
            deepAnalysis ? "bg-cyan-400/12 text-cyan-200 ring-1 ring-cyan-300/25" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
          }`}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Deep read
        </button>
        <button type="button" onClick={() => onOverlays([])} className="ml-auto paperx-icon-button" title="Clear Souji drawings" aria-label="Clear Souji chart drawings">
          <Eraser className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center py-8">
            <p className="text-base font-semibold text-white">Hey, I&apos;m Souji.</p>
            <p className="mt-2 max-w-[38ch] text-sm leading-6 text-slate-400">
              Ask me anything. Turn on Live vision when you want me to read the chart you are seeing and draw the evidence directly on it.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                "Read this chart completely",
                "What pattern is forming here?",
                "Is this intraday setup strong or weak?",
              ].map((prompt) => (
                <button key={prompt} type="button" onClick={() => setInput(prompt)} className="rounded-lg border border-white/10 px-3 py-2 text-left text-xs leading-5 text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-300/[0.04]">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((message) => (
              <article key={message.id} className={message.role === "user" ? "ml-auto max-w-[86%]" : "max-w-full"}>
                {message.role === "user" ? (
                  <div className="rounded-2xl rounded-br-md bg-cyan-300/12 px-3.5 py-2.5 text-sm leading-6 text-cyan-50">
                    {messageText(message)}
                  </div>
                ) : (
                  <div className="min-w-0 text-[0.9375rem] leading-7 text-slate-200">
                    <p className="mb-1.5 text-xs font-semibold text-cyan-300">Souji</p>
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return <ReactMarkdown key={index} skipHtml components={markdownComponents}>{part.text}</ReactMarkdown>;
                      }
                      if (part.type === "source-url") {
                        return <a key={part.url} href={part.url} target="_blank" rel="noreferrer" className="mr-2 mt-2 inline-block text-xs text-cyan-300 underline underline-offset-2">{part.title ?? "Source"}</a>;
                      }
                      if (part.type === "tool-drawChart") {
                        if (part.state === "output-available" && isDrawingOutput(part.output)) {
                          return (
                            <div key={part.toolCallId} className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2 text-xs text-cyan-100">
                              <Activity className="mr-1.5 inline h-3.5 w-3.5" />
                              Drew {part.output.overlays.length} chart annotation{part.output.overlays.length === 1 ? "" : "s"} · {part.output.explanation}
                            </div>
                          );
                        }
                        return <p key={part.toolCallId} className="mt-2 text-xs text-slate-500">Preparing chart drawings…</p>;
                      }
                      return null;
                    })}
                  </div>
                )}
              </article>
            ))}
            {status === "submitted" && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 motion-reduce:animate-none" />
                Souji is looking at the evidence…
              </div>
            )}
            <div ref={messageEndRef} />
          </div>
        )}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-200">{error.message || "Souji could not answer. Please try again."}</p>}
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-[#0b0d10] p-3">
        {live && (
          <div className="mb-2 flex items-center gap-2 text-[11px] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {frameReady ? "Chart synced · watching for changes" : "Waiting for chart…"}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void submit();
              }
            }}
            rows={2}
            maxLength={800}
            placeholder={`Ask Souji about ${symbol} or anything else…`}
            className="min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm leading-5 text-white placeholder:text-slate-500 focus:border-cyan-300/45"
          />
          {busy ? (
            <button type="button" onClick={stop} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-200 hover:bg-white/[0.05]" aria-label="Stop Souji">
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={() => void submit()} disabled={!input.trim()} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cyan-300 text-[#06242b] hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send to Souji">
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-slate-500">Souji can be opinionated, but market outcomes are uncertain. PaperX trades stay simulated.</p>
      </footer>
    </section>
  );
}
