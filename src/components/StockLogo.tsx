"use client";

import Image from "next/image";
import { useState } from "react";

export function StockLogo({
  symbol,
  logoUrl,
  size = 44,
  className = "",
}: {
  symbol: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = Boolean(logoUrl && failedUrl === logoUrl);

  const letters = symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "PX";
  const boxStyle = { width: size, height: size };

  if (!logoUrl || failed) {
    return (
      <span
        aria-label={`${symbol} logo unavailable`}
        style={boxStyle}
        className={`grid shrink-0 place-items-center rounded-xl border border-cyan-400/10 bg-cyan-400/[0.07] text-xs font-bold tracking-wide text-cyan-300 ${className}`}
      >
        {letters}
      </span>
    );
  }

  return (
    <span style={boxStyle} className={`relative block shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white ${className}`}>
      <Image
        src={logoUrl}
        alt={`${symbol} company logo`}
        fill
        sizes={`${size}px`}
        unoptimized
        className="object-contain p-1.5"
        onError={() => setFailedUrl(logoUrl)}
      />
    </span>
  );
}
