"use client";

import { useState } from "react";

export interface TickerItem {
  material: string;
  price: number;
  unit: string;
  trend: "up" | "down" | "stable";
  change: number;
  emoji: string;
}

export const DEFAULT_TICKER_DATA: TickerItem[] = [
  { material: "Copper",    price: 720, unit: "₹/kg", trend: "up",     change: 2.5,  emoji: "🟤" },
  { material: "Aluminum",  price: 185, unit: "₹/kg", trend: "up",     change: 1.1,  emoji: "⚪" },
  { material: "Steel",     price: 35,  unit: "₹/kg", trend: "down",   change: -0.8, emoji: "🔩" },
  { material: "Brass",     price: 430, unit: "₹/kg", trend: "up",     change: 1.9,  emoji: "🟡" },
  { material: "Iron",      price: 28,  unit: "₹/kg", trend: "stable", change: 0,    emoji: "⚙️" },
  { material: "Lead",      price: 165, unit: "₹/kg", trend: "up",     change: 0.6,  emoji: "🔘" },
  { material: "Plastic",   price: 25,  unit: "₹/kg", trend: "up",     change: 0.8,  emoji: "♻️" },
  { material: "Stainless", price: 85,  unit: "₹/kg", trend: "stable", change: 0,    emoji: "✨" },
];

function getTrendColor(trend: "up" | "down" | "stable"): string {
  if (trend === "up") return "#10B981";
  if (trend === "down") return "#EF4444";
  return "#94A3B8";
}

function getTrendArrow(trend: "up" | "down" | "stable"): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
}

interface MarketTickerProps {
  items?: TickerItem[];
}

/**
 * Professional endless market ticker.
 *
 * Architecture:
 * - Two identical track copies rendered side by side
 * - Parent container animated from translateX(0) to translateX(-50%)
 * - When first track leaves viewport, second track enters (seamless)
 * - Pure CSS animation: 35 seconds, linear, infinite
 * - GPU accelerated with will-change: transform
 * - No JS animation loops, no ResizeObserver
 * - Hover effect: lift + brighten, animation continues
 *
 * Result: Pixel-perfect infinite scroll with zero visible reset.
 */
export function MarketTicker({
  items = DEFAULT_TICKER_DATA,
}: MarketTickerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const TickerItem = ({ item, index }: { item: TickerItem; index: number }) => {
    const isHovered = hoveredIndex === index;

    return (
      <div
        key={`${item.material}-${index}`}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "16px 24px",
          flexShrink: 0,
          minWidth: "max-content",
          borderRight: "1px solid rgba(16,185,129,0.08)",
          transition: "all 0.2s ease",
          transform: isHovered ? "translateY(-4px)" : "translateY(0)",
          background: isHovered ? "rgba(16,185,129,0.05)" : "transparent",
          borderRadius: isHovered ? "12px" : "0",
          boxShadow: isHovered
            ? "0 8px 16px rgba(16,185,129,0.12)"
            : "none",
        }}
      >
        {/* Material Icon */}
        <span style={{ fontSize: "20px", display: "flex", alignItems: "center" }}>
          {item.emoji}
        </span>

        {/* Material Name */}
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#1F2937",
            minWidth: "90px",
          }}
        >
          {item.material}
        </span>

        {/* Price */}
        <span
          style={{
            fontSize: "13px",
            fontWeight: 800,
            color: "#111827",
            minWidth: "70px",
            textAlign: "right",
          }}
        >
          ₹{item.price}
        </span>

        {/* Unit */}
        <span
          style={{
            fontSize: "11px",
            color: "#64748B",
            minWidth: "50px",
          }}
        >
          {item.unit}
        </span>

        {/* Trend + Change */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "12px",
            fontWeight: 700,
            color: getTrendColor(item.trend),
            minWidth: "55px",
            textAlign: "right",
          }}
        >
          <span>{getTrendArrow(item.trend)}</span>
          {item.trend !== "stable" && (
            <span>{Math.abs(item.change).toFixed(1)}%</span>
          )}
        </span>
      </div>
    );
  };

  return (
    <div style={{ position: "relative", width: "100%", overflow: "hidden" }}>
      {/* Main container with floating glass aesthetic */}
      <div
        style={{
          background: "linear-gradient(180deg, #F4F7F5, #EEF3F0)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(16,185,129,0.08)",
          borderRadius: "18px",
          margin: "0 auto",
          maxWidth: "100%",
          overflow: "hidden",
          position: "relative",
          boxShadow: "0 4px 12px rgba(15,23,42,0.04)",
          height: "clamp(56px, 10vw, 72px)",
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Left fade gradient */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "40px",
            background: "linear-gradient(90deg, #F4F7F5, rgba(244,247,245,0))",
            backdropFilter: "blur(12px)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        />

        {/* Right fade gradient */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "40px",
            background: "linear-gradient(270deg, #EEF3F0, rgba(238,243,240,0))",
            backdropFilter: "blur(12px)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        />

        {/* Scrolling track container */}
        <div
          style={{
            display: "flex",
            animation: "scrollTicker 35s linear infinite",
            willChange: "transform",
            width: "max-content",
          }}
        >
          {/* Track A (first copy) */}
          <div style={{ display: "flex", width: "max-content" }}>
            {items.map((item, index) => (
              <TickerItem key={`a-${item.material}-${index}`} item={item} index={index} />
            ))}
          </div>

          {/* Track B (second copy - identical for seamless loop) */}
          <div style={{ display: "flex", width: "max-content" }}>
            {items.map((item, index) => (
              <TickerItem key={`b-${item.material}-${index}`} item={item} index={index} />
            ))}
          </div>
        </div>
      </div>

      {/* CSS Animation Keyframe */}
      <style>{`
        @keyframes scrollTicker {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *:not([style*="scrollTicker"]) {
            animation-duration: 0s !important;
          }
          /* Explicitly keep ticker animation running */
          [data-ticker-scroll] {
            animation-duration: 35s !important;
          }
        }
      `}</style>
    </div>
  );
}
