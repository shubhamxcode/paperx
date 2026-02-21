"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Candle {
  open: number;
  close: number;
  high: number;
  low: number;
  isSignal?: boolean;
}

interface Pattern {
  id: string;
  name: string;
  signal: "BUY" | "SELL";
  trend: "UPTREND" | "DOWNTREND";
  challenge: string;
  candles: Candle[];
  explanation: string;
  tip: string;
  successRate: number;
}

// ─── Pattern Data ─────────────────────────────────────────────────────────────

const PATTERNS: Pattern[] = [
  {
    id: "hammer",
    name: "Hammer",
    signal: "BUY",
    trend: "DOWNTREND",
    challenge:
      "The stock has been falling for 5 days. A new candle just formed at the bottom. What's your move?",
    candles: [
      { open: 120, close: 114, high: 121, low: 112 },
      { open: 114, close: 109, high: 115, low: 107 },
      { open: 109, close: 104, high: 110, low: 102 },
      { open: 104, close: 99, high: 105, low: 97 },
      { open: 99, close: 95, high: 100, low: 93 },
      { open: 95, close: 96.5, high: 97.5, low: 83, isSignal: true },
    ],
    explanation:
      "HAMMER! 🔨 Sellers tried to crush the price but buyers fought back hard. The long lower wick proves bulls are stepping in — strong reversal signal!",
    tip: "Look for: Small body at TOP • Long lower wick (2× body) • Almost no upper wick • Appears after a downtrend",
    successRate: 60,
  },
  {
    id: "shooting_star",
    name: "Shooting Star",
    signal: "SELL",
    trend: "UPTREND",
    challenge:
      "The stock has been rising strongly. At the peak, this candle just formed. What do you do?",
    candles: [
      { open: 80, close: 86, high: 87, low: 79 },
      { open: 86, close: 91, high: 92, low: 85 },
      { open: 91, close: 96, high: 97, low: 90 },
      { open: 96, close: 101, high: 102, low: 95 },
      { open: 101, close: 106, high: 107, low: 100 },
      { open: 106, close: 107.5, high: 120, low: 105.5, isSignal: true },
    ],
    explanation:
      "SHOOTING STAR! 🌠 Buyers pushed price way up intraday but sellers completely took over by close. The long upper wick = failed rally. Reversal incoming!",
    tip: "Look for: Small body at BOTTOM • Long upper wick (2× body) • Almost no lower wick • Appears after an uptrend",
    successRate: 60,
  },
  {
    id: "bullish_engulfing",
    name: "Bullish Engulfing",
    signal: "BUY",
    trend: "DOWNTREND",
    challenge:
      "After falling for days, a massive green candle appeared today. It looks bigger than yesterday's red candle. Your call?",
    candles: [
      { open: 115, close: 110, high: 116, low: 108 },
      { open: 110, close: 106, high: 111, low: 104 },
      { open: 106, close: 102, high: 107, low: 100 },
      { open: 102, close: 99, high: 103, low: 97 },
      { open: 99, close: 96, high: 100, low: 94 },
      { open: 95, close: 101, high: 102, low: 94.5, isSignal: true },
    ],
    explanation:
      "BULLISH ENGULFING! 🟢 The green candle completely swallowed the previous red candle. Bulls overwhelmed bears in a single session — powerful reversal!",
    tip: "Green candle opens BELOW prev low, closes ABOVE prev high. The bigger the engulf, the stronger the signal.",
    successRate: 65,
  },
  {
    id: "bearish_engulfing",
    name: "Bearish Engulfing",
    signal: "SELL",
    trend: "UPTREND",
    challenge:
      "After a strong rally, a huge red candle just appeared — bigger than yesterday's green candle. What would you do?",
    candles: [
      { open: 82, close: 87, high: 88, low: 81 },
      { open: 87, close: 92, high: 93, low: 86 },
      { open: 92, close: 97, high: 98, low: 91 },
      { open: 97, close: 101, high: 102, low: 96 },
      { open: 101, close: 105, high: 106, low: 100 },
      { open: 106, close: 100, high: 107, low: 99.5, isSignal: true },
    ],
    explanation:
      "BEARISH ENGULFING! 🔴 The red candle swallowed the entire previous green candle. Sellers took total control — downtrend likely starting!",
    tip: "Red candle opens ABOVE prev high, closes BELOW prev low. Seen at market tops — a classic exit signal.",
    successRate: 65,
  },
  {
    id: "doji_resistance",
    name: "Doji at Top",
    signal: "SELL",
    trend: "UPTREND",
    challenge:
      "After a solid uptrend, a strange candle formed where open and close are almost equal. What does this mean?",
    candles: [
      { open: 88, close: 93, high: 94, low: 87 },
      { open: 93, close: 98, high: 99, low: 92 },
      { open: 98, close: 103, high: 104, low: 97 },
      { open: 103, close: 107, high: 108, low: 102 },
      { open: 107, close: 111, high: 112, low: 106 },
      { open: 111.5, close: 111.6, high: 117, low: 105, isSignal: true },
    ],
    explanation:
      "DOJI AT TOP! ⚖️ Neither bulls nor bears won — pure indecision. At the top of an uptrend this means the trend is losing strength. High chance of reversal!",
    tip: "Doji = Open ≈ Close with long wicks. At RESISTANCE/TOP = bearish. At SUPPORT/BOTTOM = bullish.",
    successRate: 55,
  },
  {
    id: "three_white_soldiers",
    name: "Three White Soldiers",
    signal: "BUY",
    trend: "DOWNTREND",
    challenge:
      "After a long fall, three consecutive strong green candles appeared back to back. What's the signal?",
    candles: [
      { open: 122, close: 116, high: 123, low: 114 },
      { open: 116, close: 110, high: 117, low: 108 },
      { open: 110, close: 105, high: 111, low: 103 },
      { open: 105, close: 110, high: 111, low: 104 },
      { open: 110, close: 115, high: 116, low: 109 },
      { open: 115, close: 121, high: 122, low: 114, isSignal: true },
    ],
    explanation:
      "THREE WHITE SOLDIERS! 🪖🪖🪖 Three consecutive strong bullish candles = bulls completely in control. One of the strongest reversal patterns after a downtrend!",
    tip: "Each candle should: open within the previous body, close near its own high, with small wicks. Consistency is key!",
    successRate: 70,
  },
];

// ─── SVG Candlestick Renderer ──────────────────────────────────────────────

function CandlestickChart({
  candles,
  answered,
}: {
  candles: Candle[];
  answered: boolean;
}) {
  const W = 500;
  const H = 180;
  const padX = 12;
  const padY = 14;

  const allPrices = candles.flatMap((c) => [c.open, c.close, c.high, c.low]);
  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const priceRange = rawMax - rawMin || 1;
  const minP = rawMin - priceRange * 0.06;
  const maxP = rawMax + priceRange * 0.06;
  const range = maxP - minP;

  const toY = (price: number) =>
    padY + ((maxP - price) / range) * (H - padY * 2);

  const n = candles.length;
  const candleW = Math.floor((W - padX * 2) / n - 8);
  const step = (W - padX * 2) / n;

  const centerX = (i: number) => padX + step * i + step / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%" }}
    >
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={padX}
          y1={padY + f * (H - padY * 2)}
          x2={W - padX}
          y2={padY + f * (H - padY * 2)}
          stroke="var(--wash)"
          strokeWidth="1"
        />
      ))}

      {candles.map((c, i) => {
        const cx = centerX(i);
        const isGreen = c.close >= c.open;
        const bodyTop = toY(Math.max(c.open, c.close));
        const bodyBot = toY(Math.min(c.open, c.close));
        const bodyH = Math.max(bodyBot - bodyTop, 2);
        const highY = toY(c.high);
        const lowY = toY(c.low);

        const isSignal = c.isSignal;
        const showSignal = isSignal && answered;
        const dimSignal = isSignal && !answered;

        const color = isGreen ? "#16a34a" : "#dc2626";
        const opacity = dimSignal ? 0.35 : 1;

        return (
          <g key={i} opacity={opacity}>
            {/* Glow box for signal candle after answering */}
            {showSignal && (
              <rect
                x={cx - candleW / 2 - 6}
                y={highY - 6}
                width={candleW + 12}
                height={lowY - highY + 12}
                rx={3}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
            )}

            {/* Upper wick */}
            <line
              x1={cx}
              y1={highY}
              x2={cx}
              y2={bodyTop}
              stroke={color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {/* Lower wick */}
            <line
              x1={cx}
              y1={bodyBot}
              x2={cx}
              y2={lowY}
              stroke={color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {/* Body */}
            <rect
              x={cx - candleW / 2}
              y={bodyTop}
              width={candleW}
              height={bodyH}
              fill={isGreen ? color : "transparent"}
              stroke={color}
              strokeWidth="2"
            />
          </g>
        );
      })}

      {/* "?" label on signal candle before answering */}
      {!answered &&
        (() => {
          const si = candles.findIndex((c) => c.isSignal);
          if (si < 0) return null;
          const cx = centerX(si);
          return (
            <text
              x={cx}
              y={H - 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fontFamily="Space Mono, monospace"
              fill="#f59e0b"
            >
              ← THIS CANDLE
            </text>
          );
        })()}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const SimulationDemo = () => {
  const [patternIdx, setPatternIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState<"BUY" | "SELL" | null>(null);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [virtBalance, setVirtBalance] = useState(10000);

  const pattern = PATTERNS[patternIdx];
  const answered = userAnswer !== null;
  const isCorrect = answered ? userAnswer === pattern.signal : null;

  const handleAnswer = (answer: "BUY" | "SELL") => {
    if (answered) return;
    setUserAnswer(answer);
    const correct = answer === pattern.signal;
    if (correct) {
      setScore((s) => s + 1);
      setVirtBalance((b) => b + Math.floor(Math.random() * 300 + 200));
    } else {
      setVirtBalance((b) => b - Math.floor(Math.random() * 200 + 100));
    }
    setTotalAnswered((t) => t + 1);
  };

  const handleNext = () => {
    if (patternIdx + 1 >= PATTERNS.length) {
      setGameOver(true);
    } else {
      setPatternIdx((i) => i + 1);
      setUserAnswer(null);
    }
  };

  const handleRestart = () => {
    setPatternIdx(0);
    setUserAnswer(null);
    setScore(0);
    setTotalAnswered(0);
    setGameOver(false);
    setVirtBalance(10000);
  };

  // ── Game Over Screen ────────────────────────────────────────────────────
  if (gameOver) {
    const pct = Math.round((score / PATTERNS.length) * 100);
    const grade =
      pct >= 80 ? "Expert Trader 🏆" : pct >= 60 ? "Good Analyst 📈" : "Keep Learning 📚";
    return (
      <div className="container" style={{ padding: 0 }}>
        <div
          style={{
            borderBottom: "var(--border-width) solid var(--ink)",
            padding: "64px 48px",
            textAlign: "center",
            background: "var(--paper)",
          }}
        >
          <div
            style={{
              fontFamily: "Archivo, sans-serif",
              fontWeight: 800,
              fontSize: "clamp(2rem, 5vw, 3rem)",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              marginBottom: "8px",
            }}
          >
            Game Over!
          </div>
          <div
            style={{
              fontFamily: "Space Mono, monospace",
              fontSize: "14px",
              opacity: 0.6,
              marginBottom: "40px",
            }}
          >
            You got {score} out of {PATTERNS.length} patterns correct
          </div>

          <div
            style={{
              display: "inline-block",
              border: "2px solid var(--ink)",
              padding: "32px 48px",
              marginBottom: "40px",
              boxShadow: "6px 6px 0 var(--ink)",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "8px" }}>
              {pct >= 80 ? "🏆" : pct >= 60 ? "📈" : "📚"}
            </div>
            <div
              style={{
                fontFamily: "Archivo, sans-serif",
                fontWeight: 800,
                fontSize: "24px",
                textTransform: "uppercase",
              }}
            >
              {grade}
            </div>
            <div
              style={{
                fontFamily: "Space Mono, monospace",
                fontSize: "13px",
                marginTop: "8px",
                opacity: 0.7,
              }}
            >
              Virtual P&L: {virtBalance >= 10000 ? "+" : ""}₹
              {(virtBalance - 10000).toFixed(0)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "16px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={handleRestart}
              style={{
                padding: "16px 32px",
                border: "2px solid var(--ink)",
                background: "var(--ink)",
                color: "var(--paper)",
                fontFamily: "Space Mono, monospace",
                fontWeight: 700,
                fontSize: "13px",
                textTransform: "uppercase",
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
            >
              Play Again
            </button>
            <Link
              href="/login"
              style={{
                padding: "16px 32px",
                border: "2px solid var(--ink)",
                background: "transparent",
                color: "var(--ink)",
                fontFamily: "Space Mono, monospace",
                fontWeight: 700,
                fontSize: "13px",
                textTransform: "uppercase",
                textDecoration: "none",
                letterSpacing: "0.05em",
              }}
            >
              Trade with Real Data →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Game Screen ─────────────────────────────────────────────────────────
  return (
    <div className="container" style={{ padding: 0 }}>
      {/* Header */}
      <div
        style={{
          borderBottom: "var(--border-width) solid var(--ink)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--ink)",
          color: "var(--paper)",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <span
            style={{
              fontFamily: "Archivo, sans-serif",
              fontWeight: 800,
              fontSize: "16px",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
            }}
          >
            Pattern Recognition Game
          </span>
          <span
            style={{
              marginLeft: "12px",
              fontFamily: "Space Mono, monospace",
              fontSize: "11px",
              opacity: 0.6,
            }}
          >
            Learn to read candlesticks
          </span>
        </div>
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <span style={{ fontFamily: "Space Mono, monospace", fontSize: "12px" }}>
            Score:{" "}
            <strong>
              {score}/{totalAnswered}
            </strong>
          </span>
          <span style={{ fontFamily: "Space Mono, monospace", fontSize: "12px" }}>
            Pattern:{" "}
            <strong>
              {patternIdx + 1}/{PATTERNS.length}
            </strong>
          </span>
          <span
            style={{
              fontFamily: "Space Mono, monospace",
              fontSize: "12px",
              color: virtBalance >= 10000 ? "#4ade80" : "#f87171",
            }}
          >
            ₹{virtBalance.toLocaleString()}
          </span>
        </div>
      </div>

      <div
        className="sim-container"
        style={{
          borderBottom: "var(--border-width) solid var(--ink)",
          display: "grid",
          gridTemplateColumns: "3fr 2fr",
          minHeight: "480px",
        }}
      >
        {/* ── CHART SIDE ── */}
        <div
          style={{
            padding: "28px 24px 24px",
            position: "relative",
            borderRight: "var(--border-width) solid var(--ink)",
            backgroundImage:
              "linear-gradient(var(--wash) 1px, transparent 1px), linear-gradient(90deg, var(--wash) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        >
          {/* Trend badge */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" }}>
            <span
              style={{
                padding: "4px 10px",
                border: "1px solid var(--ink)",
                fontFamily: "Space Mono, monospace",
                fontSize: "11px",
                fontWeight: 700,
                background: pattern.trend === "UPTREND" ? "#dcfce7" : "#fee2e2",
                color: pattern.trend === "UPTREND" ? "#15803d" : "#dc2626",
              }}
            >
              {pattern.trend === "UPTREND" ? "▲ UPTREND" : "▼ DOWNTREND"}
            </span>
            <span
              style={{
                fontFamily: "Space Mono, monospace",
                fontSize: "11px",
                opacity: 0.5,
              }}
            >
              NIFTY 50 · 1D · [SIM]
            </span>
          </div>

          {/* Candlestick chart */}
          <div style={{ height: "220px", width: "100%" }}>
            <CandlestickChart candles={pattern.candles} answered={answered} />
          </div>

          {/* After answering: Pattern name + explanation */}
          {answered && (
            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                border: "2px solid #f59e0b",
                background: "#fffbeb",
                boxShadow: "4px 4px 0 #f59e0b",
              }}
            >
              <div
                style={{
                  fontFamily: "Archivo, sans-serif",
                  fontWeight: 800,
                  fontSize: "16px",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                  color: "#92400e",
                }}
              >
                📊 {pattern.name}
              </div>
              <p
                style={{
                  fontFamily: "Space Mono, monospace",
                  fontSize: "12px",
                  color: "#78350f",
                  marginBottom: "8px",
                  maxWidth: "100%",
                  lineHeight: 1.6,
                }}
              >
                {pattern.explanation}
              </p>
              <p
                style={{
                  fontFamily: "Space Mono, monospace",
                  fontSize: "11px",
                  color: "#92400e",
                  opacity: 0.8,
                  maxWidth: "100%",
                }}
              >
                💡 <strong>Tip:</strong> {pattern.tip}
              </p>
              <p
                style={{
                  fontFamily: "Space Mono, monospace",
                  fontSize: "11px",
                  opacity: 0.6,
                  marginTop: "6px",
                  color: "#78350f",
                }}
              >
                Historical success rate: ~{pattern.successRate}%
              </p>
            </div>
          )}
        </div>

        {/* ── DECISION SIDE ── */}
        <div
          style={{
            padding: "32px 28px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* Challenge prompt */}
          <div>
            <div
              style={{
                fontFamily: "Space Mono, monospace",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                opacity: 0.5,
                marginBottom: "10px",
              }}
            >
              Your Challenge
            </div>
            <p
              style={{
                fontFamily: "Space Mono, monospace",
                fontSize: "13px",
                lineHeight: 1.7,
                color: "var(--ink)",
                maxWidth: "100%",
              }}
            >
              {pattern.challenge}
            </p>
          </div>

          {/* Pattern name (hidden until answered) */}
          {!answered && (
            <div
              style={{
                padding: "14px",
                border: "1px dashed var(--graphite)",
                fontFamily: "Space Mono, monospace",
                fontSize: "12px",
                opacity: 0.6,
                textAlign: "center",
              }}
            >
              🕵️ Identify the pattern — Buy or Sell?
            </div>
          )}

          {/* Result after answering */}
          {answered && (
            <div
              style={{
                padding: "16px",
                border: `2px solid ${isCorrect ? "#16a34a" : "#dc2626"}`,
                background: isCorrect ? "#dcfce7" : "#fee2e2",
                boxShadow: `4px 4px 0 ${isCorrect ? "#16a34a" : "#dc2626"}`,
              }}
            >
              <div
                style={{
                  fontFamily: "Archivo, sans-serif",
                  fontWeight: 800,
                  fontSize: "18px",
                  textTransform: "uppercase",
                  color: isCorrect ? "#15803d" : "#dc2626",
                  marginBottom: "4px",
                }}
              >
                {isCorrect ? "✅ Correct!" : "❌ Wrong!"}
              </div>
              <div
                style={{
                  fontFamily: "Space Mono, monospace",
                  fontSize: "12px",
                  color: isCorrect ? "#15803d" : "#dc2626",
                  lineHeight: 1.5,
                }}
              >
                {isCorrect
                  ? `Great read! The signal was ${pattern.signal}. You profited!`
                  : `The correct call was ${pattern.signal}. You took a loss.`}
              </div>
              <div
                style={{
                  fontFamily: "Space Mono, monospace",
                  fontSize: "13px",
                  fontWeight: 700,
                  marginTop: "6px",
                  color: isCorrect ? "#15803d" : "#dc2626",
                }}
              >
                {isCorrect
                  ? `+₹${Math.floor(Math.random() * 300 + 200)} virtual profit`
                  : `-₹${Math.floor(Math.random() * 200 + 100)} virtual loss`}
              </div>
            </div>
          )}

          {/* Buy / Sell buttons */}
          {!answered && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button
                onClick={() => handleAnswer("BUY")}
                style={{
                  padding: "22px",
                  border: "2px solid #16a34a",
                  background: "#16a34a",
                  color: "#fff",
                  fontFamily: "Space Mono, monospace",
                  fontWeight: 700,
                  fontSize: "14px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                  transition: "all 0.15s",
                }}
              >
                ▲ BUY
              </button>
              <button
                onClick={() => handleAnswer("SELL")}
                style={{
                  padding: "22px",
                  border: "2px solid #dc2626",
                  background: "#dc2626",
                  color: "#fff",
                  fontFamily: "Space Mono, monospace",
                  fontWeight: 700,
                  fontSize: "14px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                  transition: "all 0.15s",
                }}
              >
                ▼ SELL
              </button>
            </div>
          )}

          {/* Answered state: show chosen answer + next button */}
          {answered && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {(["BUY", "SELL"] as const).map((option) => {
                  const isChosen = userAnswer === option;
                  const isRight = option === pattern.signal;
                  let bg = "transparent";
                  let borderColor = "var(--graphite)";
                  if (isChosen && isRight) { bg = "#dcfce7"; borderColor = "#16a34a"; }
                  if (isChosen && !isRight) { bg = "#fee2e2"; borderColor = "#dc2626"; }
                  if (!isChosen && isRight) { bg = "#dcfce7"; borderColor = "#16a34a"; }
                  return (
                    <div
                      key={option}
                      style={{
                        padding: "16px",
                        border: `2px solid ${borderColor}`,
                        background: bg,
                        fontFamily: "Space Mono, monospace",
                        fontWeight: 700,
                        fontSize: "13px",
                        textTransform: "uppercase",
                        textAlign: "center",
                        color: borderColor,
                      }}
                    >
                      {option === "BUY" ? "▲ " : "▼ "}{option}
                      {isChosen && " ← You"}
                      {!isChosen && isRight && " ← Correct"}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleNext}
                style={{
                  padding: "18px",
                  border: "2px solid var(--ink)",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  fontFamily: "Space Mono, monospace",
                  fontWeight: 700,
                  fontSize: "13px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                }}
              >
                {patternIdx + 1 < PATTERNS.length
                  ? `Next Pattern (${patternIdx + 2}/${PATTERNS.length}) →`
                  : "See Final Score →"}
              </button>
            </>
          )}

          <p
            style={{
              fontFamily: "Space Mono, monospace",
              fontSize: "10px",
              opacity: 0.45,
              lineHeight: 1.5,
            }}
          >
            * Simulated charts for education. Real live NSE data available after signup.
          </p>
        </div>
      </div>

      {/* CTA Banner */}
      <div
        style={{
          borderBottom: "var(--border-width) solid var(--ink)",
          padding: "24px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          background: "var(--ink)",
          color: "var(--paper)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "Archivo, sans-serif",
              fontWeight: 800,
              fontSize: "18px",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
            }}
          >
            Apply these patterns on real NSE data
          </div>
          <div
            style={{
              fontFamily: "Space Mono, monospace",
              fontSize: "12px",
              opacity: 0.6,
              marginTop: "4px",
            }}
          >
            Live Upstox data · Real candlesticks · Zero real money
          </div>
        </div>
        <Link
          href="/login"
          style={{
            padding: "14px 28px",
            background: "var(--paper)",
            color: "var(--ink)",
            fontWeight: 700,
            fontFamily: "Space Mono, monospace",
            fontSize: "13px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            textDecoration: "none",
            border: "2px solid var(--paper)",
            whiteSpace: "nowrap",
          }}
        >
          Start Trading Free →
        </Link>
      </div>
    </div>
  );
};
