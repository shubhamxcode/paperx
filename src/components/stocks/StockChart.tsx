"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  type UTCTimestamp,
} from "lightweight-charts";
import type { IChartApi } from "lightweight-charts";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type LearningOverlay = {
  type: "horizontal-line" | "range-zone" | "candle-marker";
  label: string;
  price: number | null;
  from: number | null;
  to: number | null;
  time: number | null;
  tone: "info" | "positive" | "warning";
};

export type StockChartHandle = {
  captureTutorViews: () => Promise<string[]>;
};

export const StockChart = forwardRef<StockChartHandle, { candles: Candle[]; type: "candles" | "line"; overlays?: LearningOverlay[] }>(function StockChart({ candles, type, overlays = [] }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleCountRef = useRef(0);

  useImperativeHandle(ref, () => ({
    captureTutorViews: async () => {
      const chart = chartRef.current;
      if (!chart) return [];
      const waitForPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const originalRange = chart.timeScale().getVisibleLogicalRange();
      const fullView = chart.takeScreenshot(true, false).toDataURL("image/png");
      if (candleCountRef.current <= 45 || !originalRange) return [fullView];

      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candleCountRef.current - 45), to: candleCountRef.current + 2 });
      await waitForPaint();
      const recentCloseUp = chart.takeScreenshot(true, false).toDataURL("image/png");
      chart.timeScale().setVisibleLogicalRange(originalRange);
      await waitForPaint();
      return [fullView, recentCloseUp];
    },
  }), []);

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
    chartRef.current = chart;
    candleCountRef.current = candles.length;

    const ordered = candles.map((candle) => ({ ...candle, time: candle.time as UTCTimestamp }));
    const priceSeries = type === "candles"
      ? chart.addSeries(CandlestickSeries, {
        upColor: "#34d399",
        downColor: "#f87171",
        borderVisible: false,
        wickUpColor: "#34d399",
        wickDownColor: "#f87171",
      })
      : chart.addSeries(AreaSeries, {
        lineColor: ordered[ordered.length - 1].close >= ordered[0].close ? "#34d399" : "#f87171",
        topColor: ordered[ordered.length - 1].close >= ordered[0].close ? "rgba(52,211,153,0.24)" : "rgba(248,113,113,0.22)",
        bottomColor: "rgba(11,13,16,0)",
        lineWidth: 2,
      });
    if (type === "candles") {
      priceSeries.setData(ordered);
    } else {
      const rising = ordered[ordered.length - 1].close >= ordered[0].close;
      const color = rising ? "#34d399" : "#f87171";
      priceSeries.applyOptions({
        lineColor: color,
        topColor: rising ? "rgba(52,211,153,0.24)" : "rgba(248,113,113,0.22)",
        bottomColor: "rgba(11,13,16,0)",
        lineWidth: 2,
      });
      priceSeries.setData(ordered.map((candle) => ({ time: candle.time, value: candle.close })));
    }

    const toneColor = { info: "#67e8f9", positive: "#34d399", warning: "#fbbf24" } as const;
    overlays.forEach((overlay) => {
      const color = toneColor[overlay.tone];
      if (overlay.type === "horizontal-line" && overlay.price != null) {
        priceSeries.createPriceLine({ price: overlay.price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: overlay.label });
      }
      if (overlay.type === "range-zone") {
        [overlay.from, overlay.to].forEach((price, index) => {
          if (price != null) priceSeries.createPriceLine({ price, color, lineWidth: 1, lineStyle: 3, axisLabelVisible: index === 0, title: index === 0 ? overlay.label : "" });
        });
      }
    });
    const markers = overlays.filter((item) => item.type === "candle-marker" && item.time != null).map((item) => ({
      time: item.time as UTCTimestamp,
      position: "aboveBar" as const,
      color: toneColor[item.tone],
      shape: "circle" as const,
      text: item.label,
    }));
    if (markers.length) createSeriesMarkers(priceSeries, markers);

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
      chartRef.current = null;
      chart.remove();
    };
  }, [candles, type, overlays]);

  return <div ref={containerRef} className="h-[430px] w-full" aria-label="Historical stock price chart" />;
});
