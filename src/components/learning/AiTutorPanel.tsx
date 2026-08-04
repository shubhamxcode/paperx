"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, BrainCircuit, ChartSpline, CheckCircle2, LoaderCircle, Maximize2, MessageCircleQuestion, Minimize2, Send, Sparkles, Square, XCircle } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import toast from "react-hot-toast";
import type { LearningOverlay } from "@/components/stocks/StockChart";

type TutorMode = "CHAT" | "VISUAL_LESSON" | "QUIZ" | "TRADE_REVIEW";
type TutorMessage = { id: string; turnId: string; role: "user" | "assistant"; content: string; loadingLabel?: string };
type PaperOrder = { id: string; instrumentKey: string; side: "BUY" | "SELL"; quantity: number; pricePaise: number | null; status: string; createdAt: string };
type Quiz = { concept: string; question: string; options: string[]; correctAnswer: number; explanation: string };
type StructuredResponse = {
  conversationId: string;
  answer: string;
  factsUsed: Array<{ label: string; value: string }>;
  overlays: LearningOverlay[];
  quiz: Quiz | null;
  followUps: string[];
};

const modes: Array<{ value: TutorMode; label: string; icon: typeof BrainCircuit; prompt: string }> = [
  { value: "CHAT", label: "Ask", icon: MessageCircleQuestion, prompt: "Explain this chart to me like I am a beginner." },
  { value: "VISUAL_LESSON", label: "Visual lesson", icon: ChartSpline, prompt: "Teach me the most important pattern in this visible chart and mark the relevant area." },
  { value: "QUIZ", label: "Quiz", icon: BookOpenCheck, prompt: "Create one beginner quiz using this chart and its real values." },
  { value: "TRADE_REVIEW", label: "Trade review", icon: BrainCircuit, prompt: "Explain how to review a completed paper trade without hindsight or financial advice." },
];

const markdownComponents: Components = {
  h1: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold leading-6 text-white first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold leading-6 text-white first:mt-0">{children}</h3>,
  h3: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold leading-6 text-white first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="mb-4 max-w-[70ch] text-pretty !text-slate-300 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-1 marker:text-slate-500">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
  em: ({ children }) => <em className="text-slate-200">{children}</em>,
  blockquote: ({ children }) => <blockquote className="my-3 rounded-lg bg-white/[0.04] px-4 py-3 text-slate-200">{children}</blockquote>,
  hr: () => <hr className="my-5 border-white/10" />,
  code: ({ className, children }) => className
    ? <code className={`${className} block max-w-full overflow-x-auto rounded-lg bg-black/30 p-3 text-sm text-slate-200`}>{children}</code>
    : <code className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[0.875rem] text-cyan-100">{children}</code>,
};

function AssistantMessage({ content, loadingLabel }: { content: string; loadingLabel?: string }) {
  if (!content) {
    return (
      <div role="status" className="flex max-w-md items-center gap-3 rounded-lg bg-white/[0.025] px-3 py-3 text-sm text-slate-300">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
          <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span className="absolute inset-0 rounded-lg ring-1 ring-cyan-300/20 motion-safe:animate-pulse" aria-hidden="true" />
        </span>
        <span>
          <span className="block font-medium text-slate-200">{loadingLabel ?? "Thinking through your question…"}</span>
          <span className="mt-1 flex items-center gap-1 text-xs text-slate-500" aria-hidden="true">
            <i className="h-1 w-1 animate-pulse rounded-full bg-cyan-300 motion-reduce:animate-none" />
            <i className="h-1 w-1 animate-pulse rounded-full bg-cyan-300 [animation-delay:150ms] motion-reduce:animate-none" />
            <i className="h-1 w-1 animate-pulse rounded-full bg-cyan-300 [animation-delay:300ms] motion-reduce:animate-none" />
          </span>
        </span>
        <span className="sr-only">PaperX Tutor is preparing a response.</span>
      </div>
    );
  }
  return (
    <div className="min-w-0 max-w-[70ch] break-words [overflow-wrap:anywhere]">
      <ReactMarkdown skipHtml components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  );
}

export function AiTutorPanel({
  instrumentKey,
  symbol,
  range,
  interval,
  captureChartViews,
  onOverlays,
}: {
  instrumentKey: string;
  symbol: string;
  range: string;
  interval: string;
  captureChartViews?: () => Promise<string[]>;
  onOverlays: (overlays: LearningOverlay[]) => void;
}) {
  const [mode, setMode] = useState<TutorMode>("CHAT");
  const [question, setQuestion] = useState(modes[0].prompt);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [structured, setStructured] = useState<StructuredResponse | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number>();
  const [answerResult, setAnswerResult] = useState<boolean>();
  const [mastery, setMastery] = useState<Array<{ concept: string; mastery: number }>>([]);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [orderId, setOrderId] = useState<string>();
  const controllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  const active = useMemo(() => modes.find((item) => item.value === mode) ?? modes[0], [mode]);
  const visibleInterval = useMemo(() => ({ "1D": interval, "1W": "30m", "1M": "1h", "3M": "1 day", "1Y": "1 day", "5Y": "1 week" }[range] ?? interval), [range, interval]);

  useEffect(() => {
    fetch("/api/ai/progress").then((response) => response.ok ? response.json() : null).then((body) => setMastery(body?.progress ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/orders?limit=100")
      .then((response) => response.ok ? response.json() : null)
      .then((body) => {
        const matching = (body?.orders ?? []).filter((order: PaperOrder) => order.instrumentKey === instrumentKey);
        setOrders(matching);
        setOrderId(matching[0]?.id);
      })
      .catch(() => undefined);
  }, [instrumentKey]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
        window.requestAnimationFrame(() => expandButtonRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKeys);
    };
  }, [expanded]);

  useEffect(() => {
    if (busy || expanded) conversationEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, structured, busy, expanded]);

  const chooseMode = (next: TutorMode) => {
    const item = modes.find((entry) => entry.value === next) ?? modes[0];
    setMode(next);
    setQuestion(item.prompt);
    setStructured(null);
    setSelectedAnswer(undefined);
    setAnswerResult(undefined);
    if (next !== "VISUAL_LESSON") onOverlays([]);
  };

  const ask = async (suggested?: string) => {
    const text = (suggested ?? question).trim();
    if (text.length < 2 || busy) return;
    const controller = new AbortController();
    const turnId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const loadingLabel = {
      CHAT: "Thinking through your question…",
      VISUAL_LESSON: "Reading the chart and preparing annotations…",
      QUIZ: "Building a question from this chart…",
      TRADE_REVIEW: "Reviewing your selected paper trade…",
    }[mode];
    controllerRef.current = controller;
    setBusy(true);
    setRequestError(undefined);
    setStructured(null);
    setAnswerResult(undefined);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), turnId, role: "user", content: text },
      { id: assistantId, turnId, role: "assistant", content: "", loadingLabel },
    ]);
    try {
      const needsChartVision = mode === "VISUAL_LESSON" || mode === "QUIZ" || (mode === "CHAT" && /\b(?:this|current|visible|chart|candle|price|volume|trend|support|resistance|high|low|pattern)\b/i.test(text));
      const chartImages = needsChartVision ? await captureChartViews?.().catch(() => []) ?? [] : [];
      const response = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ instrumentKey, question: text, mode, range, interval, conversationId, orderId: mode === "TRADE_REVIEW" ? orderId : undefined, chartImages }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "The tutor could not answer");
      }
      const id = response.headers.get("X-PaperX-Conversation");
      if (id) setConversationId(id);

      if (mode === "CHAT") {
        if (!response.body) throw new Error("Streaming response unavailable");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let answer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            answer += decoder.decode();
            break;
          }
          answer += decoder.decode(value, { stream: true });
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: answer } : message));
        }
        if (!answer.trim()) throw new Error("The tutor returned an empty response");
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: answer } : message));
      } else {
        const body = await response.json() as StructuredResponse;
        setStructured(body);
        setConversationId(body.conversationId);
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: body.answer } : message));
        onOverlays(mode === "VISUAL_LESSON" ? body.overlays : []);
      }
      setQuestion("");
    } catch (error) {
      setMessages((current) => current.filter((message) => message.turnId !== turnId));
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        const message = error instanceof Error ? error.message : "The tutor could not answer";
        setRequestError(message);
        toast.error(message);
      }
    } finally {
      controllerRef.current = null;
      setBusy(false);
    }
  };

  const answerQuiz = async (index: number) => {
    if (!structured?.quiz || selectedAnswer != null) return;
    setSelectedAnswer(index);
    const correct = index === structured.quiz.correctAnswer;
    setAnswerResult(correct);
    await fetch("/api/ai/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instrumentKey, concept: structured.quiz.concept, question: structured.quiz.question, selectedAnswer: index, correctAnswer: structured.quiz.correctAnswer, explanation: structured.quiz.explanation }),
    }).catch(() => undefined);
    setMastery((current) => {
      const found = current.find((item) => item.concept === structured.quiz?.concept);
      if (!found) return [...current, { concept: structured.quiz!.concept, mastery: correct ? 20 : 5 }];
      return current.map((item) => item.concept === found.concept ? { ...item, mastery: Math.min(100, item.mastery + (correct ? 20 : 5)) } : item);
    });
  };

  return (
    <section className="border-t border-white/10 py-8" aria-labelledby="ai-tutor-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
            <h2 id="ai-tutor-heading" className="text-lg font-semibold text-white">PaperX Tutor</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">Turn {symbol}&apos;s real chart into a lesson. Gemini explains; PaperX supplies and validates every market fact.</p>
        </div>
        {mastery.length > 0 && <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-slate-400"><span className="font-medium text-white">Learning progress</span> · {Math.round(mastery.reduce((sum, item) => sum + item.mastery, 0) / mastery.length)}% average</div>}
      </div>

      {expanded && <button type="button" aria-label="Exit full-screen tutor" onClick={() => setExpanded(false)} className="fixed inset-0 z-40 cursor-default bg-black/80" />}
      <div ref={panelRef} role={expanded ? "dialog" : undefined} aria-modal={expanded || undefined} aria-label={expanded ? "PaperX Tutor full screen" : undefined} className={`${expanded ? "fixed inset-0 z-50 mt-0 flex h-[100dvh] min-h-0 flex-col sm:inset-6 sm:h-auto sm:rounded-xl sm:border" : "mt-5 rounded-xl border"} overflow-hidden border-white/10 bg-[#0b0d10]`}>
        <div className="flex min-h-14 items-center justify-between gap-2 border-b border-white/10 px-2">
          <div className="flex min-w-0 gap-1 overflow-x-auto py-2" role="tablist" aria-label="Tutor mode">
            {modes.map((item) => {
              const Icon = item.icon;
              return <button key={item.value} role="tab" aria-selected={mode === item.value} onClick={() => chooseMode(item.value)} className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm transition-colors ${mode === item.value ? "bg-cyan-400/10 text-cyan-200" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}><Icon className="h-4 w-4" />{item.label}</button>;
            })}
          </div>
          <button ref={expandButtonRef} type="button" onClick={() => setExpanded((value) => !value)} className="paperx-icon-button shrink-0" aria-pressed={expanded} aria-label={expanded ? "Exit full-screen tutor" : "Open tutor full screen"} title={expanded ? "Exit full screen (Esc)" : "Open full screen"}>
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        <div className={`${expanded ? "min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_300px]" : "lg:grid-cols-[minmax(0,1fr)_250px]"} grid`}>
          <div className="flex min-h-0 min-w-0 flex-col">
            <div className={`${expanded ? "min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8" : "p-4 sm:p-5"}`}>
            {messages.length === 0 ? (
              <div className="py-6">
                <h3 className="text-base font-medium text-white">Why this exists</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Charts show what happened, but beginners often do not know what to notice. The tutor explains the visible evidence without predicting what happens next or touching your paper account.</p>
                <button onClick={() => void ask(active.prompt)} className="mt-4 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-[#06242b] hover:bg-cyan-300">Start this lesson</button>
              </div>
            ) : (
              <div className={`${expanded ? "mx-auto max-w-4xl" : "max-h-[460px]"} min-w-0 space-y-5 overflow-x-hidden overflow-y-auto pr-1`} aria-live="polite">
                {messages.map((message) => message.role === "user" ? (
                  <div key={message.id} className="ml-auto max-w-[min(85%,42rem)] break-words rounded-xl bg-cyan-400/10 px-4 py-3 text-sm leading-6 text-cyan-100 [overflow-wrap:anywhere]">
                    <p className="mb-1 text-xs font-medium text-cyan-300">You</p>
                    {message.content}
                  </div>
                ) : (
                  <div key={message.id} className="min-w-0 text-[0.9375rem] leading-6 tracking-[0.01em] text-slate-300">
                    <p className="mb-2 text-xs font-semibold text-cyan-300">PaperX Tutor</p>
                    <AssistantMessage content={message.content} loadingLabel={message.loadingLabel} />
                  </div>
                ))}
              </div>
            )}

            {requestError && <div role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm leading-5 text-red-200">{requestError} Please try again.</div>}

            {structured?.quiz && (
              <div className="mt-5 border-t border-white/10 pt-5">
                <p className="text-xs font-medium text-cyan-300">Quick check · {structured.quiz.concept}</p>
                <h3 className="mt-2 text-base font-medium leading-6 text-white">{structured.quiz.question}</h3>
                <div className="mt-4 space-y-2">
                  {structured.quiz.options.map((option, index) => {
                    const chosen = selectedAnswer === index;
                    const correct = structured.quiz?.correctAnswer === index;
                    return <button key={option} disabled={selectedAnswer != null} onClick={() => void answerQuiz(index)} className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left text-sm ${selectedAnswer == null ? "border-white/10 text-slate-300 hover:border-cyan-400/40 hover:bg-cyan-400/[0.04]" : correct ? "border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-200" : chosen ? "border-red-400/40 bg-red-400/[0.06] text-red-200" : "border-white/5 text-slate-600"}`}><span>{option}</span>{selectedAnswer != null && correct && <CheckCircle2 className="h-4 w-4" />}{selectedAnswer != null && chosen && !correct && <XCircle className="h-4 w-4" />}</button>;
                  })}
                </div>
                {answerResult != null && <p className={`mt-3 max-w-[70ch] text-sm leading-6 ${answerResult ? "text-emerald-300" : "text-amber-300"}`}>{answerResult ? "Correct. " : "Not quite. "}{structured.quiz.explanation}</p>}
              </div>
            )}

            {mode === "TRADE_REVIEW" && (
              <label className="mt-5 block border-t border-white/10 pt-4">
                <span className="mb-2 block text-xs font-medium text-slate-300">Paper trade to review</span>
                <select value={orderId ?? ""} onChange={(event) => setOrderId(event.target.value || undefined)} className="h-11 w-full rounded-lg border border-white/10 bg-[#11151a] px-3 text-sm text-white focus:border-cyan-400/50">
                  <option value="">General review (no completed trade yet)</option>
                  {orders.map((order) => <option key={order.id} value={order.id}>{order.side} {order.quantity} @ {order.pricePaise == null ? "—" : `₹${(order.pricePaise / 100).toFixed(2)}`} · {new Date(order.createdAt).toLocaleDateString("en-IN")}</option>)}
                </select>
              </label>
            )}
            <div ref={conversationEndRef} />
            </div>

            <div className={`${expanded ? "bg-[#0b0d10] px-5 py-4 sm:px-8" : "mx-4 mb-4 mt-1 pt-4 sm:mx-5 sm:mb-5"} shrink-0 border-t border-white/10`}>
              <div className="mx-auto flex max-w-4xl items-end gap-2">
              <label className="min-w-0 flex-1"><span className="sr-only">Ask PaperX Tutor</span><textarea ref={inputRef} rows={2} aria-keyshortcuts="Enter" value={question} maxLength={800} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(); } }} placeholder={`Ask about ${symbol}'s visible chart…`} className="min-h-12 w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-6 text-white placeholder:text-slate-400 focus:border-cyan-400/50" /></label>
              {busy ? <button onClick={() => controllerRef.current?.abort()} className="paperx-icon-button h-12 w-12" aria-label="Stop tutor"><Square className="h-4 w-4" /></button> : <button onClick={() => void ask()} disabled={question.trim().length < 2} className="flex h-12 items-center gap-2 rounded-lg bg-cyan-400 px-4 text-sm font-semibold text-[#06242b] hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /><span className="hidden sm:inline">Ask</span></button>}
              </div>
              <div className="mx-auto mt-2 flex max-w-4xl items-center justify-between gap-3 text-xs text-slate-400"><p>Educational only — not financial advice.</p><p className="hidden sm:block"><kbd className="rounded border border-white/10 px-1.5 py-0.5">Enter</kbd> send · <kbd className="rounded border border-white/10 px-1.5 py-0.5">Shift Enter</kbd> new line</p></div>
            </div>
          </div>

          <aside className={`${expanded ? "hidden min-h-0 overflow-y-auto lg:block" : ""} border-t border-white/10 bg-white/[0.02] p-4 lg:border-t-0 lg:border-l`} aria-label="Tutor context">
            <p className="text-sm font-semibold text-white">Tutor context</p>
            <dl className="mt-3 space-y-3 break-words text-[0.8125rem]"><div><dt className="text-slate-500">Instrument</dt><dd className="mt-1 text-slate-300">{symbol}</dd></div><div><dt className="text-slate-500">Visible chart</dt><dd className="mt-1 text-slate-300">{range} · {visibleInterval}</dd></div><div><dt className="text-slate-500">Data authority</dt><dd className="mt-1 text-slate-300">PaperX + Upstox</dd></div><div><dt className="text-slate-500">AI authority</dt><dd className="mt-1 text-slate-300">Explain only</dd></div></dl>
            {structured?.factsUsed?.length ? <div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs font-medium text-white">Facts used</p><ul className="mt-2 space-y-2 break-words">{structured.factsUsed.map((fact) => <li key={fact.label} className="text-xs text-slate-400"><span className="text-slate-200">{fact.label}</span><br />{fact.value}</li>)}</ul></div> : null}
            {structured?.followUps?.length ? <div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs font-medium text-white">Try next</p><div className="mt-2 space-y-2">{structured.followUps.map((prompt) => <button key={prompt} onClick={() => { setQuestion(prompt); void ask(prompt); }} className="block w-full break-words rounded-lg border border-white/10 px-3 py-2 text-left text-sm leading-5 text-slate-400 hover:border-cyan-400/30 hover:text-cyan-200">{prompt}</button>)}</div></div> : null}
          </aside>
        </div>
      </div>
    </section>
  );
}
