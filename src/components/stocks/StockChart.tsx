"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type UTCTimestamp,
} from "lightweight-charts";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function StockChart({ candles, type }: { candles: Candle[]; type: "candles" | "line" }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    const chart = createChart(containerRef.current, {
      height: 430,
      layout: {
        background: { type: ColorType.Solid, color: "#0b0d10" },
        textColor: "#94a3b8",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.035)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      crosshair: {
        vertLine: { color: "rgba(103,232,249,0.45)", labelBackgroundColor: "#164e63" },
        horzLine: { color: "rgba(103,232,249,0.45)", labelBackgroundColor: "#164e63" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      localization: {
        priceFormatter: (price: number) => `₹${price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
      },
    });

    const ordered = candles.map((candle) => ({ ...candle, time: candle.time as UTCTimestamp }));
    if (type === "candles") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#34d399",
        downColor: "#f87171",
        borderVisible: false,
        wickUpColor: "#34d399",
        wickDownColor: "#f87171",
      });
      series.setData(ordered);
    } else {
      const rising = ordered[ordered.length - 1].close >= ordered[0].close;
      const color = rising ? "#34d399" : "#f87171";
      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: rising ? "rgba(52,211,153,0.24)" : "rgba(248,113,113,0.22)",
        bottomColor: "rgba(11,13,16,0)",
        lineWidth: 2,
      });
      series.setData(ordered.map((candle) => ({ time: candle.time, value: candle.close })));
    }

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "rgba(103,232,249,0.26)",
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(ordered.map((candle) => ({
      time: candle.time,
      value: candle.volume,
      color: candle.close >= candle.open ? "rgba(52,211,153,0.32)" : "rgba(248,113,113,0.30)",
    })));
    chart.timeScale().fitContent();

    const resize = new ResizeObserver(([entry]) => chart.applyOptions({ width: entry.contentRect.width }));
    resize.observe(containerRef.current);
    return () => {
      resize.disconnect();
      chart.remove();
    };
  }, [candles, type]);

  return <div ref={containerRef} className="h-[430px] w-full" aria-label="Historical stock price chart" />;
}
