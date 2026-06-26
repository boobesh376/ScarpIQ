"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  formatPrice,
  formatChange,
  getStatusBadge,
  getSourceCredibility,
  createSparklinePath,
  searchMaterials,
  filterByCategory,
  generateMarketInsights,
  enrichMarketDataWithFallbacks,
} from "@/lib/marketPricingHelpers";
import {
  MATERIAL_CONFIG,
  MATERIAL_CATEGORIES,
  EnrichedMaterial,
} from "@/lib/marketConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

type DataStatus = "live" | "delayed" | "fallback" | "loading";

// ─── Per-material surface palette ─────────────────────────────────────────────

const MATERIAL_PALETTE: Record<string, {
  surface: string;
  border: string;
  accent: string;
  iconBg: string;
  chartColor: string;
  glowColor: string;
}> = {
  copper:   { surface: "#FFF7F1", border: "#FDDCBF", accent: "#C2410C", iconBg: "#FED7AA", chartColor: "#EA580C", glowColor: "rgba(234,88,12,0.12)"   },
  aluminum: { surface: "#F0FAFF", border: "#BAE6FD", accent: "#0284C7", iconBg: "#DBEAFE", chartColor: "#0EA5E9", glowColor: "rgba(14,165,233,0.12)"  },
  steel:    { surface: "#F8FAFC", border: "#CBD5E1", accent: "#475569", iconBg: "#E2E8F0", chartColor: "#64748B", glowColor: "rgba(100,116,139,0.12)" },
  iron:     { surface: "#F1F5F9", border: "#CBD5E1", accent: "#334155", iconBg: "#E2E8F0", chartColor: "#475569", glowColor: "rgba(71,85,105,0.12)"   },
  brass:    { surface: "#FEFCE8", border: "#FDE68A", accent: "#B45309", iconBg: "#FEF3C7", chartColor: "#D97706", glowColor: "rgba(217,119,6,0.12)"   },
  plastic:  { surface: "#F2FBF7", border: "#A7F3D0", accent: "#059669", iconBg: "#D1FAE5", chartColor: "#10B981", glowColor: "rgba(16,185,129,0.12)"  },
};

const DEFAULT_PALETTE = MATERIAL_PALETTE.steel;

// ─── Safe helpers ─────────────────────────────────────────────────────────────

function safePrice(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function safeNum(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}
function safeStr(val: unknown, fallback = "—"): string {
  return typeof val === "string" && val.length > 0 ? val : fallback;
}
function safeTrend(trend: unknown): number[] {
  if (!Array.isArray(trend) || trend.length === 0) return [50, 50, 50, 50, 50, 50, 50];
  const valid = trend.map(Number).filter(v => Number.isFinite(v) && v > 0);
  return valid.length >= 2 ? valid : [50, 50, 50, 50, 50, 50, 50];
}
function getDataStatus(materials: Record<string, EnrichedMaterial>): DataStatus {
  const entries = Object.values(materials);
  if (entries.length === 0) return "loading";
  if (entries.every(m => m.source === "fallback")) return "fallback";
  if (entries.some(m => m.isStale)) return "delayed";
  return "live";
}
function fmtTime(ts: number | null): string {
  if (!ts || !Number.isFinite(ts)) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── LivePulse ────────────────────────────────────────────────────────────────

function LivePulse({ color = "#10B981", size = 7 }: { color?: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: size + 4, height: size + 4 }}>
      <span style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: color, opacity: 0.3, animation: "dRipple 2s ease-out infinite" }} />
      <span style={{ width: size, height: size, borderRadius: "50%", background: color, display: "block", flexShrink: 0 }} />
    </span>
  );
}

// ─── ZoneLabel ────────────────────────────────────────────────────────────────

function ZoneLabel({ icon, text, color, live }: { icon: string; text: string; color: string; live?: boolean }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      background: `${color}12`, border: `1.5px solid ${color}28`,
      borderRadius: 999, padding: "5px 13px 5px 9px",
      fontSize: 11.5, fontWeight: 700, color, letterSpacing: "0.025em",
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      {text}
      {live && <LivePulse color={color} />}
    </div>
  );
}

// ─── AnimBar ──────────────────────────────────────────────────────────────────

function AnimBar({ value, color, height = 4 }: { value: number; color: string; height?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), 300);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div style={{ height, background: "rgba(0,0,0,0.07)", borderRadius: 99, overflow: "hidden", flex: 1 }}>
      <div style={{
        height: "100%", width: `${w}%`, borderRadius: 99,
        background: `linear-gradient(90deg, ${color}, ${color}BB)`,
        transition: "width 1.1s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: `0 0 8px ${color}50`,
      }} />
    </div>
  );
}

// ─── Rich Sparkline ───────────────────────────────────────────────────────────

function RichSparkline({ trend, status, color }: { trend: unknown; status: "rising" | "falling" | "stable"; color: string }) {
  const points = safeTrend(trend);
  const pts = createSparklinePath(points, 100, 36);

  // Build SVG fill path from the same points
  const fillPath = (() => {
    const validPoints = points.filter(p => Number.isFinite(p));
    if (validPoints.length < 2) return "";
    const xStep = 100 / (validPoints.length - 1);
    const min = Math.min(...validPoints);
    const max = Math.max(...validPoints);
    const range = max - min || 1;
    const coords = validPoints.map((p, i) => `${i * xStep},${36 - ((p - min) / range) * 32}`);
    return `M ${coords.join(" L ")} L ${(validPoints.length - 1) * xStep},36 L 0,36 Z`;
  })();

  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden style={{ width: "100%", height: 36, display: "block" }}>
      <defs>
        <linearGradient id={`sg-${status}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {fillPath && <path d={fillPath} fill={`url(#sg-${status})`} />}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ─── Status Badge (light-mode) ────────────────────────────────────────────────

function StatusBadge({ status }: { status: DataStatus }) {
  const cfg: Record<DataStatus, { label: string; color: string; bg: string; border: string }> = {
    live:     { label: "Live",     color: "#059669", bg: "#D1FAE5", border: "rgba(5,150,105,0.3)"  },
    delayed:  { label: "Delayed",  color: "#B45309", bg: "#FEF3C7", border: "rgba(180,83,9,0.3)"   },
    fallback: { label: "Fallback", color: "#DC2626", bg: "#FEE2E2", border: "rgba(220,38,38,0.3)"  },
    loading:  { label: "Loading",  color: "#64748B", bg: "#F1F5F9", border: "rgba(100,116,139,0.3)" },
  };
  const c = cfg[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
      background: c.bg, color: c.color, border: `1.5px solid ${c.border}`,
      userSelect: "none",
    }}>
      <LivePulse color={c.color} size={6} />
      {c.label}
    </span>
  );
}

// ─── Source chip (light-mode) ─────────────────────────────────────────────────

function SourceChip({ materialId, data }: { materialId: string; data: EnrichedMaterial }) {
  const config = MATERIAL_CONFIG[materialId];
  const isTier2 = config?.tier === "fallback";
  const cred = getSourceCredibility(safeStr(data.source, "unknown"), Boolean(data.isCached), Boolean(data.isStale));

  let label = "Live";
  let color = "#059669";
  let bg = "#D1FAE5";
  let border = "rgba(5,150,105,0.25)";

  if (isTier2) {
    if (data.source === "fallback") { label = "Estimated"; color = "#B45309"; bg = "#FEF3C7"; border = "rgba(180,83,9,0.25)"; }
    else { label = "Cached"; color = "#0284C7"; bg = "#DBEAFE"; border = "rgba(2,132,199,0.25)"; }
  } else {
    if (cred.level === "stale")    { label = "Stale";    color = "#DC2626"; bg = "#FEE2E2"; border = "rgba(220,38,38,0.25)"; }
    else if (cred.level === "cached") { label = "Cached"; color = "#0284C7"; bg = "#DBEAFE"; border = "rgba(2,132,199,0.25)"; }
    else if (cred.level === "fallback") { label = "Fallback"; color = "#B45309"; bg = "#FEF3C7"; border = "rgba(180,83,9,0.25)"; }
  }

  return (
    <span style={{
      fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
      background: bg, color, border: `1px solid ${border}`,
      letterSpacing: "0.04em",
    }}>
      {label}
    </span>
  );
}

// ─── PriceCard ────────────────────────────────────────────────────────────────

function PriceCard({ materialId, data }: { materialId: string; data: EnrichedMaterial }) {
  const [hov, setHov] = useState(false);
  const config = MATERIAL_CONFIG[materialId];
  if (!config) return null;

  const pal = MATERIAL_PALETTE[materialId] ?? DEFAULT_PALETTE;
  const price = safePrice(data.price);
  const changePercent = safeNum(data.changePercent);
  const status = (["rising", "falling", "stable"].includes(data.status) ? data.status : "stable") as "rising" | "falling" | "stable";
  const changeFmt = formatChange(changePercent);
  const badge = getStatusBadge(status);
  const insight = safeStr(data.insight, `${config.name} — market data available`);
  const minutesAgo = safeStr(data.minutesAgo, "");
  const isTier2 = config.tier === "fallback";

  // Trend status badge colors (light versions)
  const trendBg    = status === "rising" ? "#DCFCE7" : status === "falling" ? "#FEE2E2" : "#DBEAFE";
  const trendColor = status === "rising" ? "#15803D" : status === "falling" ? "#B91C1C" : "#1D4ED8";
  const trendBorder = status === "rising" ? "rgba(21,128,61,0.28)" : status === "falling" ? "rgba(185,28,28,0.28)" : "rgba(29,78,216,0.28)";

  // Confidence derived from source quality
  const confidence = isTier2 ? 72 : status === "rising" ? 91 : status === "falling" ? 87 : 83;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? pal.surface : "#FFFFFF",
        border: `1.5px solid ${hov ? pal.border : "#E0EDE6"}`,
        borderRadius: 20, padding: 22,
        display: "flex", flexDirection: "column", gap: 0,
        transition: "all 0.22s cubic-bezier(0.16,1,0.3,1)",
        transform: hov ? "translateY(-4px)" : undefined,
        boxShadow: hov
          ? `0 18px 44px ${pal.glowColor}, 0 4px 12px rgba(15,23,42,0.06)`
          : "0 1px 4px rgba(15,23,42,0.05)",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Animated border glow strip on hover */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${pal.accent}00, ${pal.accent}, ${pal.accent}00)`,
        opacity: hov ? 1 : 0,
        transition: "opacity 0.25s ease",
        borderRadius: "20px 20px 0 0",
      }} />

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: pal.iconBg,
            border: `1.5px solid ${pal.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
            transition: "transform 0.25s ease",
            transform: hov ? "scale(1.1) rotate(-5deg)" : undefined,
          }}>
            {config.icon}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{config.name}</div>
            <div style={{ fontSize: 10.5, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>
              {config.category.replace("-", " ")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
          <span style={{
            padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 700,
            background: trendBg, color: trendColor, border: `1px solid ${trendBorder}`,
            whiteSpace: "nowrap",
          }}>
            {badge.emoji} {badge.label}
          </span>
          <SourceChip materialId={materialId} data={data} />
        </div>
      </div>

      {/* Price + change */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingBottom: 14, borderBottom: `1px solid ${hov ? pal.border : "#F1F5F9"}`,
        marginBottom: 14, transition: "border-color 0.22s ease",
      }}>
        <div style={{
          fontSize: 28, fontWeight: 900, color: hov ? pal.accent : "#0F172A",
          letterSpacing: "-0.04em", lineHeight: 1,
          transition: "color 0.22s ease",
        }}>
          {price > 0 ? formatPrice(price) : "Updating…"}
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
          background: status === "rising" ? "#DCFCE7" : status === "falling" ? "#FEE2E2" : "#F1F5F9",
          color: changeFmt.color,
          border: `1px solid ${status === "rising" ? "rgba(21,128,61,0.2)" : status === "falling" ? "rgba(185,28,28,0.2)" : "#E2E8F0"}`,
        }}>
          {changeFmt.text}
        </span>
      </div>

      {/* 7-day sparkline */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontWeight: 600 }}>
          7-Day Trend
        </div>
        <RichSparkline trend={data.trend} status={status} color={pal.chartColor} />
      </div>

      {/* Confidence indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600, flexShrink: 0, width: 68 }}>
          Confidence
        </span>
        <AnimBar value={confidence} color={pal.accent} height={4} />
        <span style={{ fontSize: 11, fontWeight: 800, color: pal.accent, flexShrink: 0, minWidth: 28 }}>
          {confidence}%
        </span>
      </div>

      {/* Insight */}
      <p style={{
        fontSize: 12, color: "#64748B", lineHeight: 1.6,
        margin: "0 0 14px", flexGrow: 1,
        fontStyle: "italic",
      }}>
        {insight}
      </p>

      {/* Source + unit row */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 11, color: "#94A3B8", marginBottom: 16,
      }}>
        <span>
          {isTier2 ? "⚡ Estimated data" : minutesAgo ? `Updated ${minutesAgo}` : "Live data"}
        </span>
        <span style={{
          background: "#F8FAFC", border: "1px solid #E2E8F0",
          borderRadius: 999, padding: "2px 9px", fontSize: 10, fontWeight: 600, color: "#64748B",
        }}>
          USD/lb
        </span>
      </div>

      {/* CTA */}
      <Link
        href={`/upload?material=${materialId}`}
        style={{
          display: "block", textAlign: "center",
          padding: "10px 0",
          background: hov
            ? `linear-gradient(135deg, ${pal.accent} 0%, ${pal.accent}CC 100%)`
            : `linear-gradient(135deg, #10B981 0%, #059669 100%)`,
          color: "#fff",
          borderRadius: 12, textDecoration: "none",
          fontSize: 13, fontWeight: 700, letterSpacing: "0.01em",
          boxShadow: hov ? `0 6px 20px ${pal.glowColor}` : "0 4px 12px rgba(16,185,129,0.28)",
          transition: "background 0.25s ease, box-shadow 0.25s ease",
        }}
      >
        Analyze {config.name} →
      </Link>
    </div>
  );
}

// ─── AI Market Briefing ───────────────────────────────────────────────────────

function AIMarketBriefing({
  insights, marketData,
}: {
  insights: string[];
  marketData: Record<string, EnrichedMaterial>;
}) {
  const entries = Object.entries(marketData);
  if (entries.length === 0) return null;

  const getCP = (d: EnrichedMaterial) => (Number.isFinite(d.changePercent) ? d.changePercent : 0);
  const topOpp  = entries.reduce((a, b) => getCP(a[1]) >= getCP(b[1]) ? a : b);
  const topRisk = entries.reduce((a, b) => getCP(a[1]) <= getCP(b[1]) ? a : b);
  const trending = entries.filter(([, d]) => d.status === "rising").sort((a, b) => getCP(b[1]) - getCP(a[1]))[0];

  const topOppConfig  = MATERIAL_CONFIG[topOpp[0]];
  const topRiskConfig = MATERIAL_CONFIG[topRisk[0]];
  const trendConfig   = trending ? MATERIAL_CONFIG[trending[0]] : null;

  const briefCards = [
    {
      icon: "📈", label: "Top Opportunity",
      title: topOppConfig?.name ?? "—",
      sub: `${getCP(topOpp[1]) > 0 ? "+" : ""}${getCP(topOpp[1]).toFixed(2)}% change`,
      color: "#059669", bg: "#D1FAE5", border: "rgba(5,150,105,0.25)",
    },
    {
      icon: "⚠️", label: "Top Risk",
      title: topRiskConfig?.name ?? "—",
      sub: `${getCP(topRisk[1]) > 0 ? "+" : ""}${getCP(topRisk[1]).toFixed(2)}% change`,
      color: "#DC2626", bg: "#FEE2E2", border: "rgba(220,38,38,0.25)",
    },
    {
      icon: "🔥", label: "Trending",
      title: trendConfig?.name ?? "Stable market",
      sub: trendConfig ? "Currently rising" : "No strong movers",
      color: "#D97706", bg: "#FEF3C7", border: "rgba(217,119,6,0.25)",
    },
    {
      icon: "🧠", label: "AI Signal",
      title: insights.includes("📈 Market broadly higher") ? "Bullish" : insights.includes("📉 Market broadly lower") ? "Bearish" : "Mixed",
      sub: insights.find(s => !s.startsWith("📈") && !s.startsWith("📉") && !s.startsWith("➡️")) ?? "Monitor closely",
      color: "#6D28D9", bg: "#EDE9FE", border: "rgba(109,40,217,0.25)",
    },
  ];

  return (
    <div style={{
      background: "#F5F3FF", border: "1.5px solid #DDD6FE",
      borderRadius: 24, padding: "24px 26px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <ZoneLabel icon="🧠" text="AI Market Briefing" color="#6D28D9" live />
        <span style={{ fontSize: 11, color: "#7C3AED", fontWeight: 600 }}>
          Based on live commodity data
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {briefCards.map(card => (
          <div key={card.label} style={{
            background: "#FFFFFF", border: `1.5px solid ${card.border}`,
            borderRadius: 16, padding: "16px",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 22px ${card.color}18`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10, marginBottom: 10,
              background: card.bg, border: `1px solid ${card.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>
              {card.icon}
            </div>
            <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 4, textTransform: "uppercase" }}>
              {card.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 3, letterSpacing: "-0.01em" }}>{card.title}</div>
            <div style={{ fontSize: 11.5, color: card.color, fontWeight: 600 }}>{card.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Market Intelligence Toolbar ──────────────────────────────────────────────

function MarketToolbar({
  searchQuery, setSearchQuery,
  selectedCategory, setSelectedCategory,
  refreshing, onRefresh,
  lastUpdated, dataStatus,
  error,
}: {
  searchQuery: string; setSearchQuery: (v: string) => void;
  selectedCategory: string; setSelectedCategory: (v: string) => void;
  refreshing: boolean; onRefresh: () => void;
  lastUpdated: number | null; dataStatus: DataStatus;
  error: string | null;
}) {
  const [searchFocus, setSearchFocus] = useState(false);
  return (
    <div style={{
      background: "#F7FDF9", border: "1.5px solid #C8E8D8",
      borderRadius: 20, padding: "18px 20px", marginBottom: 16,
    }}>
      {/* Top row: status + last updated */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ZoneLabel icon="📡" text="Market Intelligence Toolbar" color="#059669" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11.5, color: "#64748B", fontWeight: 500 }}>
              Updated {fmtTime(lastUpdated)}
            </span>
          )}
          <StatusBadge status={dataStatus} />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: "10px 14px", background: "#FEF2F2",
          border: "1.5px solid rgba(220,38,38,0.22)", borderRadius: 12,
          fontSize: 12.5, color: "#DC2626", marginBottom: 14,
        }}>
          ⚠️ {error} — showing best available data
        </div>
      )}

      {/* Controls row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Search materials…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setSearchFocus(false)}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "10px 14px 10px 36px",
              background: "#FFFFFF",
              border: `1.5px solid ${searchFocus ? "#10B981" : "#D1EDE0"}`,
              borderRadius: 12, color: "#0F172A", fontSize: 13.5,
              outline: "none", transition: "border-color 0.18s ease",
              boxShadow: searchFocus ? "0 0 0 3px rgba(16,185,129,0.1)" : undefined,
            }}
          />
        </div>

        {/* Category filter */}
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          style={{
            padding: "10px 14px",
            background: "#FFFFFF", border: "1.5px solid #D1EDE0",
            borderRadius: 12, color: selectedCategory ? "#0F172A" : "#94A3B8",
            fontSize: 13.5, cursor: "pointer", outline: "none",
            minWidth: 160,
          }}
        >
          <option value="">All Categories</option>
          {MATERIAL_CATEGORIES.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.label}</option>
          ))}
        </select>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            padding: "10px 20px",
            background: refreshing ? "#F8FAFC" : "linear-gradient(135deg, #10B981 0%, #059669 100%)",
            color: refreshing ? "#94A3B8" : "#fff",
            border: `1.5px solid ${refreshing ? "#E2E8F0" : "transparent"}`,
            borderRadius: 12, fontSize: 13, fontWeight: 700,
            cursor: refreshing ? "default" : "pointer",
            whiteSpace: "nowrap",
            boxShadow: refreshing ? "none" : "0 4px 14px rgba(16,185,129,0.3)",
            transition: "all 0.2s ease",
          }}
        >
          {refreshing ? "Updating…" : "↻ Refresh"}
        </button>
      </div>
    </div>
  );
}

// ─── How Pricing Works ────────────────────────────────────────────────────────

function HowPricingWorks() {
  const steps = [
    { icon: "📊", num: "01", title: "Market Data", desc: "Live commodity indices refresh every 4 minutes from global exchanges." },
    { icon: "🔬", num: "02", title: "Material Analysis", desc: "AI identifies material type, purity grade, and current market position." },
    { icon: "🧠", num: "03", title: "AI Pricing Engine", desc: "ScrapIQ engine cross-references 6+ data sources for accurate valuation." },
    { icon: "✅", num: "04", title: "Final Valuation", desc: "Price estimate delivered with confidence score and market insight." },
  ];

  return (
    <div style={{
      background: "#F0FAFF", border: "1.5px solid #BAE6FD",
      borderRadius: 24, padding: "28px 26px", marginBottom: 16,
    }}>
      <div style={{ marginBottom: 20 }}>
        <ZoneLabel icon="⚙️" text="How Pricing Works" color="#0284C7" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {steps.map((step, i) => (
          <div key={step.num} style={{ position: "relative" }}>
            <div style={{
              background: "#FFFFFF", border: "1.5px solid #BAE6FD",
              borderRadius: 18, padding: "20px 18px",
              height: "100%",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 28px rgba(2,132,199,0.1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11,
                  background: "#DBEAFE", border: "1.5px solid rgba(2,132,199,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
                }}>
                  {step.icon}
                </div>
                <span style={{
                  fontSize: 10.5, fontWeight: 800, color: "#0284C7",
                  letterSpacing: "0.08em",
                }}>
                  STEP {step.num}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>{step.title}</div>
              <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6 }}>{step.desc}</div>
            </div>
            {/* Connector arrow between steps */}
            {i < steps.length - 1 && (
              <div style={{
                display: "none", // hidden on mobile; visible via grid positioning
                position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)",
                fontSize: 14, color: "#93C5FD", zIndex: 1,
              }}>→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bottom CTA ───────────────────────────────────────────────────────────────

function BottomCTA() {
  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 40%, #EDE9FE 100%)",
      border: "1.5px solid #A7F3D0",
      borderRadius: 24, padding: "40px 36px", textAlign: "center",
    }}>
      {/* Decorative blobs */}
      <div style={{ position: "absolute", top: -80, right: -60, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 68%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -70, left: -50, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(109,40,217,0.12) 0%, transparent 68%)", pointerEvents: "none" }} />

      <div style={{ position: "relative" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(5,150,105,0.12)", border: "1.5px solid rgba(5,150,105,0.28)",
          borderRadius: 999, padding: "6px 16px 6px 11px",
          fontSize: 11.5, fontWeight: 700, color: "#065F46",
          letterSpacing: "0.04em", marginBottom: 20,
        }}>
          <LivePulse color="#059669" />
          AI-POWERED INSTANT VALUATION
        </div>

        <h2 style={{
          fontSize: "clamp(22px, 3.5vw, 34px)", fontWeight: 900,
          color: "#022C22", letterSpacing: "-0.035em", lineHeight: 1.2,
          margin: "0 0 12px",
        }}>
          Know exactly what your scrap is worth
        </h2>
        <p style={{
          fontSize: 15, color: "#374151", lineHeight: 1.65,
          margin: "0 auto 32px", maxWidth: 480,
        }}>
          Upload a photo and get a price estimate based on live market rates, material condition, and AI analysis — in seconds.
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <Link
            href="/upload"
            style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              padding: "14px 32px",
              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
              color: "#fff", fontSize: 15, fontWeight: 700,
              borderRadius: 15, textDecoration: "none",
              boxShadow: "0 10px 30px rgba(5,150,105,0.38)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(5,150,105,0.48)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 10px 30px rgba(5,150,105,0.38)"; }}
          >
            Start Analysis
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link href="/history" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "14px 26px",
            background: "rgba(255,255,255,0.75)", border: "1.5px solid rgba(5,150,105,0.3)",
            color: "#059669", fontSize: 14, fontWeight: 700,
            borderRadius: 15, textDecoration: "none",
            backdropFilter: "blur(6px)",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.75)"; }}
          >
            View History →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton (light mode) ────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ background: "#FAFBFC", border: "1.5px solid #E8F0E9", borderRadius: 20, padding: 22 }}>
      {[72, 45, 90, 28, 60, 38, 100].map((w, i) => (
        <div key={i} style={{
          height: i === 2 ? 36 : i === 3 ? 4 : 13,
          width: `${w}%`,
          background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)",
          backgroundSize: "200% 100%",
          borderRadius: i === 3 ? 99 : 6, marginBottom: 14,
          animation: "dShimmer 1.5s infinite",
        }} />
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div style={{
      textAlign: "center", padding: "72px 24px",
      background: "#FFFFFF", border: "1.5px solid #E0EDE6",
      borderRadius: 20,
    }}>
      <div style={{ fontSize: 40, marginBottom: 14, animation: "dFloat 3s ease-in-out infinite" }}>🔍</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
        No materials match
      </div>
      <div style={{ fontSize: 13.5, color: "#64748B", marginBottom: 24 }}>
        Try adjusting your search or filter
      </div>
      <button
        onClick={onReset}
        style={{
          padding: "10px 28px",
          background: "linear-gradient(135deg, #10B981, #059669)",
          color: "#fff", border: "none", borderRadius: 12,
          fontSize: 13, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
        }}
      >
        Clear Filters
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricesPage() {
  const [marketData, setMarketData] = useState<Record<string, EnrichedMaterial> | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [searchQuery, setSearchQuery]       = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [refreshing, setRefreshing]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [dataStatus, setDataStatus]   = useState<DataStatus>("loading");
  const hasData = useRef(false);

  const fetchMarketData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      const res = await fetch(`${baseUrl}/market-prices`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const raw = json?.data?.materials ?? json?.data ?? {};
      if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("Unexpected response shape");

      const KNOWN = new Set(["copper", "aluminum", "steel", "iron", "brass", "plastic"]);
      const materials: Record<string, EnrichedMaterial> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (KNOWN.has(k) && v && typeof v === "object") materials[k] = v as EnrichedMaterial;
      }
      const enriched = enrichMarketDataWithFallbacks(materials);
      setMarketData(enriched);
      setLastUpdated(Date.now());
      setDataStatus(getDataStatus(enriched));
      setError(null);
      hasData.current = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fetch failed";
      setError(msg);
      if (!hasData.current) setDataStatus("fallback");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData();
    const iv = setInterval(() => fetchMarketData(true), 4 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchMarketData]);

  const displayed = (() => {
    let result = marketData ? { ...marketData } : {};
    if (searchQuery.trim()) result = searchMaterials(searchQuery, result);
    if (selectedCategory)   result = filterByCategory(selectedCategory, result);
    return result;
  })();

  const insights = marketData ? generateMarketInsights(marketData) : [];

  function resetFilters() { setSearchQuery(""); setSelectedCategory(""); }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 clamp(8px, 4vw, 20px)" }}>
        {/* Page hero skeleton */}
        <div style={{
          background: "linear-gradient(135deg, #EAF8F1 0%, #F2FBF7 60%, #F0FAFF 100%)",
          border: "1.5px solid #C8E8D8", borderRadius: 24, padding: "32px 28px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#059669", marginBottom: 16 }}>
            <ZoneLabel icon="💹" text="ScrapIQ Market Intelligence Center" color="#059669" live />
          </div>
          <div style={{ height: 32, width: "45%", background: "#DCF0E8", borderRadius: 8, marginBottom: 10 }} />
          <div style={{ height: 16, width: "60%", background: "#EAF5EE", borderRadius: 6 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <style>{`@keyframes dShimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }`}</style>
      </div>
    );
  }

  // ── Full page ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      maxWidth: 1320, margin: "0 auto",
      padding: "0 clamp(8px, 4vw, 20px)",
      display: "flex", flexDirection: "column", gap: 16,
    }}>

      {/* ── PAGE HERO ─────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: "linear-gradient(140deg, #EDFAF4 0%, #D4F1E4 35%, #E8F4FF 70%, #EEE8FF 100%)",
        border: "1.5px solid #B8E6D0", borderRadius: 24, padding: "34px 30px",
        animation: "dReveal 0.6s cubic-bezier(0.16,1,0.3,1) both",
      }}>
        <div style={{ position: "absolute", top: -100, right: -80, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, left: "10%", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(109,40,217,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />

        <div style={{ position: "relative" }}>
          <div style={{ marginBottom: 18 }}>
            <ZoneLabel icon="💹" text="ScrapIQ Market Intelligence Center" color="#059669" live />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "center" }}>
            <div>
              <h1 style={{
                fontSize: "clamp(22px, 3.5vw, 36px)", fontWeight: 900,
                letterSpacing: "-0.04em", color: "#0A2218", lineHeight: 1.18, marginBottom: 10,
              }}>
                Live Scrap Material Prices 📊
              </h1>
              <p style={{ fontSize: 14.5, color: "#374151", lineHeight: 1.65, maxWidth: 520 }}>
                Real-time commodity pricing updated every 4 minutes. Use live rates to make smarter decisions about when and what to sell.
              </p>
            </div>
            <div style={{
              flexShrink: 0, background: "rgba(255,255,255,0.65)",
              border: "1.5px solid rgba(5,150,105,0.2)",
              borderRadius: 18, padding: "16px 20px", textAlign: "center",
              backdropFilter: "blur(6px)",
              minWidth: 140,
            }}>
              <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>TRACKING</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#059669", letterSpacing: "-0.04em", lineHeight: 1 }}>6</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>Materials</div>
              <div style={{ height: 1, background: "rgba(5,150,105,0.15)", margin: "12px 0" }} />
              <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>REFRESH</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Every 4 min</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MARKET INTELLIGENCE TOOLBAR ───────────────────────────────────── */}
      <MarketToolbar
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
        refreshing={refreshing} onRefresh={() => fetchMarketData(true)}
        lastUpdated={lastUpdated} dataStatus={dataStatus}
        error={error}
      />

      {/* ── AI MARKET BRIEFING ────────────────────────────────────────────── */}
      {marketData && Object.keys(marketData).length > 0 && (
        <AIMarketBriefing insights={insights} marketData={marketData} />
      )}

      {/* ── PRICE CARDS GRID ──────────────────────────────────────────────── */}
      {Object.keys(displayed).length > 0 ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(285px, 1fr))",
          gap: 14,
        }}>
          {Object.entries(displayed).map(([id, data], i) => (
            <div
              key={id}
              style={{
                opacity: 0,
                animation: `dReveal 0.55s cubic-bezier(0.16,1,0.3,1) both`,
                animationDelay: `${0.04 + i * 0.06}s`,
              }}
            >
              <PriceCard materialId={id} data={data} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState onReset={resetFilters} />
      )}

      {/* ── HOW PRICING WORKS ─────────────────────────────────────────────── */}
      <HowPricingWorks />

      {/* ── BOTTOM CTA ────────────────────────────────────────────────────── */}
      <BottomCTA />

      <style>{`
        @keyframes dReveal {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dRipple {
          0%   { transform: scale(0.7); opacity: 0.5; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes dFloat {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes dShimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        input::placeholder { color: #94A3B8; }
        select option { background: #fff; color: #0F172A; }
      `}</style>
    </div>
  );
}