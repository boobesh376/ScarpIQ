"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, getUserDisplayName } from "@/lib/authService";
import { fetchHistory, type AnalysisRecord } from "@/lib/api";
import {
  MOCK_MARKET_PRICES,
  generateInsights,
  calculateEnvironmentalImpact,
  getUserInitials,
  formatJoinedDate,
  getTrendColor,
  type MarketPrice,
} from "@/lib/dashboardHelpers";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import styles from "./Dashboard.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuickAction {
  icon: string;
  title: string;
  desc: string;
  href: string;
  color: string;
  surface: string;
  borderColor: string;
}

interface StatCard {
  label: string;
  value: string | number;
}

interface Activity {
  id: string;
  title: string;
  time: string;
  value: string;
  material?: string | null;
}

// ── Static data ───────────────────────────────────────────────────────────────

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: "📤",
    title: "Analyze Scrap",
    desc: "Upload a photo for an instant AI price estimate",
    href: "/upload",
    color: "#059669",
    surface: "#D1FAE5",
    borderColor: "rgba(5,150,105,0.3)",
  },
  {
    icon: "📜",
    title: "View History",
    desc: "Browse all your previous AI analyses",
    href: "/history",
    color: "#0284C7",
    surface: "#DBEAFE",
    borderColor: "rgba(2,132,199,0.3)",
  },
  {
    icon: "💰",
    title: "Pricing Guide",
    desc: "Live material rates and market data",
    href: "/prices",
    color: "#B45309",
    surface: "#FEF3C7",
    borderColor: "rgba(180,83,9,0.3)",
  },
  {
    icon: "👥",
    title: "Community",
    desc: "Connect and trade with scrap dealers",
    href: "/community",
    color: "#6D28D9",
    surface: "#EDE9FE",
    borderColor: "rgba(109,40,217,0.3)",
  },
];

const INSIGHT_FEED = [
  {
    id: "i1",
    title: "Copper demand spike detected",
    desc: "Industrial buyers are increasing purchase volume in Chennai and Coimbatore markets — optimal sell window opening in the next 3–5 days.",
    confidence: 94,
    priority: "HIGH" as const,
    category: "Opportunity",
    categoryColor: "#059669",
    categorySurface: "#D1FAE5",
    categoryBorder: "rgba(5,150,105,0.25)",
    timestamp: "2 min ago",
    icon: "📈",
  },
  {
    id: "i2",
    title: "Aluminum prices softening",
    desc: "Short-term correction expected due to import surplus. Consider holding for 4–7 days before selling at better margins.",
    confidence: 81,
    priority: "MED" as const,
    category: "Pricing Alert",
    categoryColor: "#B45309",
    categorySurface: "#FEF3C7",
    categoryBorder: "rgba(180,83,9,0.25)",
    timestamp: "18 min ago",
    icon: "⚠️",
  },
  {
    id: "i3",
    title: "Steel prices expected to rise",
    desc: "Seasonal construction demand and reduced imports are supporting steel floor prices. Next week may see a 3–5% increase.",
    confidence: 88,
    priority: "MED" as const,
    category: "Market Insight",
    categoryColor: "#0284C7",
    categorySurface: "#DBEAFE",
    categoryBorder: "rgba(2,132,199,0.25)",
    timestamp: "1 hr ago",
    icon: "📊",
  },
];

const AI_SUMMARY_LINES = [
  { emoji: "🟤", material: "Copper", text: "Demand rising in Chennai markets.", trend: "up" as const },
  { emoji: "⚪", material: "Aluminum", text: "Stable — hold for better pricing.", trend: "stable" as const },
  { emoji: "🔩", material: "Steel", text: "Prices expected to increase next week.", trend: "up" as const },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(new Date(iso));
  } catch { return iso; }
}

function formatPrice(price: number | null): string {
  if (price === null || price === undefined || isNaN(price)) return "—";
  return `₹${price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function materialEmoji(material: string | null): string {
  switch (material?.toLowerCase()) {
    case "copper":   return "🟤";
    case "aluminum": return "⚪";
    case "iron":     return "⚙️";
    case "steel":    return "🔩";
    case "plastic":  return "♻️";
    default:         return "📦";
  }
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useCountUp(target: number, active: boolean, duration = 1300) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active || isNaN(target)) return;
    let t0: number | null = null;
    let raf = 0;
    const tick = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return val;
}

// ── Primitive components ──────────────────────────────────────────────────────

/** Animated progress bar */
function AnimBar({
  value, color, height = 5, delay = 200,
}: {
  value: number; color: string; height?: number; delay?: number;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div style={{
      height, background: "rgba(0,0,0,0.07)", borderRadius: 99,
      overflow: "hidden", flex: 1,
    }}>
      <div style={{
        height: "100%", width: `${w}%`, borderRadius: 99,
        background: `linear-gradient(90deg, ${color}, ${color}CC)`,
        transition: "width 1.1s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: `0 0 10px ${color}50`,
      }} />
    </div>
  );
}

/** Ripple live indicator */
function LivePulse({ color = "#10B981", size = 8 }: { color?: string; size?: number }) {
  return (
    <span style={{
      position: "relative", display: "inline-flex",
      alignItems: "center", justifyContent: "center",
      width: size + 4, height: size + 4,
    }}>
      <span style={{
        position: "absolute", width: "100%", height: "100%", borderRadius: "50%",
        background: color, opacity: 0.3,
        animation: "dRipple 2s ease-out infinite",
      }} />
      <span style={{
        width: size, height: size, borderRadius: "50%",
        background: color, flexShrink: 0, display: "block",
      }} />
    </span>
  );
}

/** Section zone label pill */
function ZoneLabel({
  icon, text, color, live, dim,
}: {
  icon: string; text: string; color: string; live?: boolean; dim?: string;
}) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      background: `${color}14`, border: `1.5px solid ${color}30`,
      borderRadius: 999, padding: "5px 13px 5px 9px",
      fontSize: 11.5, fontWeight: 700, color,
      letterSpacing: "0.025em", marginBottom: 20,
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      {text}
      {dim && <span style={{ color: `${color}80`, fontWeight: 500 }}>{dim}</span>}
      {live && <LivePulse color={color} />}
    </div>
  );
}

// ── AI Specimen Viewer (hero visual centerpiece) ──────────────────────────────
// The AI Specimen Viewer shows what ScrapIQ actually does: an AI inspects
// a real scrap object. Five scrap items cycle through a glass inspection window.
// For each object: a scan beam sweeps top-to-bottom, material tags emerge,
// a confidence meter fills, a valuation price appears. Then it fades and the
// next object arrives. The loop tells the ScrapIQ story without words.
//
// Phases per object (total ~6.5s per cycle):
//   0–0.6s   → object fades in, tray glows on
//   0.6–2.2s → scan beam sweeps (1.6s sweep)
//   2.2–3.6s → tags + confidence animate in
//   3.6–5.2s → valuation price counts up, object tinted
//   5.2–6.0s → hold
//   6.0–6.5s → fade out → next object

interface SpecimenItem {
  id: string;
  name: string;
  grade: string;
  price: string;
  confidence: number;
  color: string;       // accent colour used for glow + tags
  tint: string;        // subtle fill tint after scan
  tags: string[];
  // SVG path describing the object silhouette (viewBox 0 0 120 120)
  svg: string;
}

const SPECIMEN_ITEMS: SpecimenItem[] = [
  {
    id: "copper-wire",
    name: "Copper Wire Coil",
    grade: "Grade A — Clean",
    price: "₹8,750",
    confidence: 97,
    color: "#C2410C",
    tint: "rgba(194,65,12,0.06)",
    tags: ["Non-ferrous", "Cu 98%", "High demand"],
    svg: `
      <ellipse cx="60" cy="62" rx="38" ry="22" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
      <ellipse cx="60" cy="56" rx="38" ry="22" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
      <ellipse cx="60" cy="50" rx="38" ry="22" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
      <ellipse cx="60" cy="44" rx="38" ry="22" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
      <ellipse cx="60" cy="38" rx="38" ry="22" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.6" strokeLinecap="round"/>
      <line x1="22" y1="38" x2="18" y2="60" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="98" y1="38" x2="102" y2="60" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
    `,
  },
  {
    id: "aluminium-can",
    name: "Aluminium Can",
    grade: "Grade B — UBC",
    price: "₹1,640",
    confidence: 94,
    color: "#0284C7",
    tint: "rgba(2,132,199,0.06)",
    tags: ["Non-ferrous", "Al 91%", "UBC grade"],
    svg: `
      <rect x="36" y="22" width="48" height="78" rx="10" fill="none" stroke="currentColor" strokeWidth="3.5"/>
      <ellipse cx="60" cy="22" rx="24" ry="8" fill="none" stroke="currentColor" strokeWidth="3"/>
      <ellipse cx="60" cy="100" rx="24" ry="8" fill="none" stroke="currentColor" strokeWidth="3"/>
      <line x1="36" y1="34" x2="84" y2="34" stroke="currentColor" strokeWidth="2" opacity="0.4"/>
      <line x1="36" y1="90" x2="84" y2="90" stroke="currentColor" strokeWidth="2" opacity="0.4"/>
      <line x1="52" y1="18" x2="68" y2="18" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="60" cy="18" r="4" fill="currentColor" opacity="0.5"/>
    `,
  },
  {
    id: "steel-pipe",
    name: "Steel Pipe",
    grade: "Grade MS — Mild",
    price: "₹2,310",
    confidence: 91,
    color: "#475569",
    tint: "rgba(71,85,105,0.05)",
    tags: ["Ferrous", "Fe 88%", "Mild steel"],
    svg: `
      <ellipse cx="60" cy="32" rx="28" ry="10" fill="none" stroke="currentColor" strokeWidth="3.5"/>
      <ellipse cx="60" cy="32" rx="16" ry="5.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
      <line x1="32" y1="32" x2="32" y2="92" stroke="currentColor" strokeWidth="3.5"/>
      <line x1="88" y1="32" x2="88" y2="92" stroke="currentColor" strokeWidth="3.5"/>
      <ellipse cx="60" cy="92" rx="28" ry="10" fill="none" stroke="currentColor" strokeWidth="3.5"/>
      <ellipse cx="60" cy="92" rx="16" ry="5.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
    `,
  },
  {
    id: "circuit-board",
    name: "Circuit Board",
    grade: "Grade PCB — Mixed",
    price: "₹3,200",
    confidence: 88,
    color: "#059669",
    tint: "rgba(5,150,105,0.06)",
    tags: ["E-waste", "Au traces", "PCB grade"],
    svg: `
      <rect x="18" y="28" width="84" height="64" rx="4" fill="none" stroke="currentColor" strokeWidth="3"/>
      <rect x="28" y="38" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="50" y="38" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="78" y="38" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="28" y="60" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="46" y="62" width="28" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="82" y="60" width="8" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
      <line x1="18" y1="76" x2="14" y2="76" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="18" y1="80" x2="14" y2="80" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="18" y1="84" x2="14" y2="84" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="102" y1="44" x2="106" y2="44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="102" y1="50" x2="106" y2="50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="102" y1="56" x2="106" y2="56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="35" y1="48" x2="50" y2="48" stroke="currentColor" strokeWidth="1.5" opacity="0.4" strokeLinecap="round"/>
      <line x1="70" y1="45" x2="78" y2="45" stroke="currentColor" strokeWidth="1.5" opacity="0.4" strokeLinecap="round"/>
      <line x1="38" y1="70" x2="46" y2="66" stroke="currentColor" strokeWidth="1.5" opacity="0.4" strokeLinecap="round"/>
    `,
  },
  {
    id: "motor-coil",
    name: "Electric Motor",
    grade: "Grade A — Whole",
    price: "₹5,400",
    confidence: 92,
    color: "#7C3AED",
    tint: "rgba(124,58,237,0.05)",
    tags: ["Mixed metal", "Cu + Fe", "Whole unit"],
    svg: `
      <ellipse cx="60" cy="60" rx="36" ry="36" fill="none" stroke="currentColor" strokeWidth="3.5"/>
      <ellipse cx="60" cy="60" rx="20" ry="20" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <ellipse cx="60" cy="60" rx="8"  ry="8"  fill="currentColor" opacity="0.18"/>
      <circle  cx="60" cy="60" r="4"   fill="currentColor" opacity="0.55"/>
      <line x1="60" y1="24" x2="60" y2="40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
      <line x1="60" y1="80" x2="60" y2="96" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
      <line x1="24" y1="60" x2="40" y2="60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
      <line x1="80" y1="60" x2="96" y2="60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
      <line x1="34" y1="34" x2="46" y2="46" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" opacity="0.45"/>
      <line x1="86" y1="34" x2="74" y2="46" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" opacity="0.45"/>
      <line x1="34" y1="86" x2="46" y2="74" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" opacity="0.45"/>
      <line x1="86" y1="86" x2="74" y2="74" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" opacity="0.45"/>
      <line x1="56" y1="24" x2="64" y2="24" stroke="currentColor" strokeWidth="3"   strokeLinecap="round"/>
    `,
  },
];

// Phase timing (ms) — total cycle = 6500ms
const PHASE = {
  ENTER:      0,
  SCAN_START: 600,
  TAGS_START: 2200,
  PRICE_START:3600,
  HOLD_END:   6000,
  CYCLE:      6500,
};

function ScrapIntelligenceEngine() {
  const [itemIdx,    setItemIdx]    = useState(0);
  const [phase,      setPhase]      = useState<"enter"|"scan"|"tags"|"price"|"hold"|"exit">("enter");
  const [confidence, setConfidence] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const runCycle = useCallback((idx: number) => {
    clearAll();
    const item = SPECIMEN_ITEMS[idx];
    setItemIdx(idx);
    setPhase("enter");
    setConfidence(0);

    const t = (ms: number, fn: () => void) => {
      const id = setTimeout(fn, ms);
      timers.current.push(id);
    };

    t(PHASE.SCAN_START,  () => setPhase("scan"));
    t(PHASE.TAGS_START,  () => setPhase("tags"));
    t(PHASE.PRICE_START, () => {
      setPhase("price");
      // count confidence up over 800ms
      let start: number | null = null;
      const target = item.confidence;
      const tick = (ts: number) => {
        if (start === null) start = ts;
        const p = Math.min((ts - start) / 800, 1);
        setConfidence(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    t(PHASE.HOLD_END,    () => setPhase("exit"));
    t(PHASE.CYCLE,       () => runCycle((idx + 1) % SPECIMEN_ITEMS.length));
  }, [clearAll]);

  useEffect(() => {
    runCycle(0);
    return clearAll;
  }, [runCycle, clearAll]);

  const item = SPECIMEN_ITEMS[itemIdx];
  const isVisible  = phase !== "exit";
  const isScanning = phase === "scan";
  const showTags   = phase === "tags" || phase === "price" || phase === "hold";
  const showPrice  = phase === "price" || phase === "hold";
  const scanned    = showTags;

  return (
    <div
      className="engine-container"
      style={{
        position: "relative",
        width: 300, height: 310,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* ── Ambient floor glow ── */}
      <div style={{
        position: "absolute",
        bottom: -12, left: "10%", right: "10%",
        height: 40,
        background: `radial-gradient(ellipse, ${item.color}22 0%, transparent 72%)`,
        filter: "blur(10px)",
        transition: "background 1.2s ease",
        pointerEvents: "none",
      }} />

      {/* ── Glass inspection tray ── */}
      <div style={{
        position: "relative",
        width: 260,
        height: 260,
        borderRadius: 28,
        background: "linear-gradient(160deg, rgba(255,255,255,0.82) 0%, rgba(240,253,248,0.72) 50%, rgba(232,244,255,0.78) 100%)",
        border: "1.5px solid rgba(255,255,255,0.9)",
        boxShadow: [
          "0 2px 1px rgba(255,255,255,0.9) inset",
          "0 -1px 0 rgba(255,255,255,0.5) inset",
          scanned ? `0 0 0 1.5px ${item.color}30` : "0 0 0 1.5px rgba(5,150,105,0.12)",
          "0 20px 60px rgba(15,23,42,0.08)",
          "0 4px 16px rgba(15,23,42,0.04)",
        ].join(", "),
        transition: "box-shadow 0.7s ease",
        overflow: "hidden",
        backdropFilter: "blur(12px)",
      }}>

        {/* Tray surface tint after scan */}
        <div style={{
          position: "absolute", inset: 0,
          background: scanned ? item.tint : "transparent",
          transition: "background 0.8s ease",
          pointerEvents: "none",
          borderRadius: 26,
        }} />

        {/* Corner bracket reticle marks */}
        {[
          { top: 14, left: 14,  rotate: 0   },
          { top: 14, right: 14, rotate: 90  },
          { bottom: 14, right: 14, rotate: 180 },
          { bottom: 14, left: 14,  rotate: 270 },
        ].map((pos, i) => {
          const { rotate, ...stylePosition } = pos;
          return (
            <svg key={i} width="18" height="18" viewBox="0 0 18 18" fill="none"
              style={{
                position: "absolute",
                ...stylePosition,
                transform: `rotate(${rotate}deg)`,
                opacity: isScanning ? 1 : 0.4,
                transition: "opacity 0.4s ease",
              }}
            >
              <path d="M1 10 L1 1 L10 1" stroke={item.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
            </svg>
          );
        })}

        {/* ── Scrap object silhouette ── */}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.96)",
          transition: "opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1)",
        }}>
          <svg
            width="130" height="130"
            viewBox="0 0 120 120"
            fill="none"
            style={{
              color: scanned ? item.color : "#94A3B8",
              filter: scanned
                ? `drop-shadow(0 0 8px ${item.color}55) drop-shadow(0 0 20px ${item.color}22)`
                : "none",
              transition: "color 0.8s ease, filter 0.8s ease",
            }}
            dangerouslySetInnerHTML={{ __html: item.svg }}
          />
        </div>

        {/* ── Scan beam ── */}
        {isScanning && (
          <div style={{
            position: "absolute",
            left: 0, right: 0,
            height: 3,
            background: `linear-gradient(90deg, transparent 0%, ${item.color}60 20%, ${item.color} 50%, ${item.color}60 80%, transparent 100%)`,
            boxShadow: `0 0 14px ${item.color}80, 0 0 32px ${item.color}30`,
            animation: "specimenBeam 1.6s cubic-bezier(0.37,0,0.63,1) forwards",
            zIndex: 10,
            pointerEvents: "none",
          }}>
            {/* Beam trailing glow */}
            <div style={{
              position: "absolute",
              top: 3, left: 0, right: 0,
              height: 20,
              background: `linear-gradient(180deg, ${item.color}18, transparent)`,
              pointerEvents: "none",
            }} />
          </div>
        )}

        {/* ── AI analysis overlay lines (appear post-scan) ── */}
        {showTags && (
          <svg
            width="260" height="260" viewBox="0 0 260 260"
            style={{
              position: "absolute", inset: 0,
              pointerEvents: "none", zIndex: 5,
              opacity: 0,
              animation: "specimenFadeIn 0.4s ease 0.1s forwards",
            }}
          >
            <defs>
              <linearGradient id={`aLine-${item.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={item.color} stopOpacity="0.7"/>
                <stop offset="100%" stopColor={item.color} stopOpacity="0.05"/>
              </linearGradient>
            </defs>
            {/* Measurement lines */}
            <line x1="48" y1="48" x2="72" y2="48" stroke={item.color} strokeWidth="1" opacity="0.5" strokeLinecap="round"/>
            <line x1="48" y1="48" x2="48" y2="72" stroke={item.color} strokeWidth="1" opacity="0.5" strokeLinecap="round"/>
            <line x1="212" y1="48" x2="188" y2="48" stroke={item.color} strokeWidth="1" opacity="0.5" strokeLinecap="round"/>
            <line x1="212" y1="48" x2="212" y2="72" stroke={item.color} strokeWidth="1" opacity="0.5" strokeLinecap="round"/>
            <line x1="48" y1="212" x2="72" y2="212" stroke={item.color} strokeWidth="1" opacity="0.5" strokeLinecap="round"/>
            <line x1="48" y1="212" x2="48" y2="188" stroke={item.color} strokeWidth="1" opacity="0.5" strokeLinecap="round"/>
            {/* Horizontal dimension guide */}
            <line x1="80" y1="230" x2="180" y2="230" stroke={item.color} strokeWidth="0.8" opacity="0.3" strokeDasharray="3 3"/>
            <line x1="80" y1="226" x2="80" y2="234" stroke={item.color} strokeWidth="1" opacity="0.4" strokeLinecap="round"/>
            <line x1="180" y1="226" x2="180" y2="234" stroke={item.color} strokeWidth="1" opacity="0.4" strokeLinecap="round"/>
          </svg>
        )}

        {/* ── Material type label (top centre, post-scan) ── */}
        {showTags && (
          <div style={{
            position: "absolute",
            top: 14, left: 0, right: 0,
            display: "flex", justifyContent: "center",
            zIndex: 8,
            opacity: 0,
            animation: "specimenTagIn 0.35s cubic-bezier(0.16,1,0.3,1) 0.05s forwards",
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "rgba(255,255,255,0.92)",
              border: `1px solid ${item.color}35`,
              borderRadius: 999,
              padding: "4px 11px",
              backdropFilter: "blur(8px)",
              boxShadow: `0 2px 10px ${item.color}18`,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: item.color, boxShadow: `0 0 4px ${item.color}` }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: item.color, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                {item.name}
              </span>
            </div>
          </div>
        )}

        {/* ── Tag pills (bottom row, post-scan) ── */}
        {showTags && (
          <div style={{
            position: "absolute",
            bottom: 14, left: 12, right: 12,
            display: "flex", justifyContent: "center", gap: 5,
            zIndex: 8,
            flexWrap: "wrap",
          }}>
            {item.tags.map((tag, i) => (
              <div key={tag} style={{
                background: "rgba(255,255,255,0.9)",
                border: `1px solid ${item.color}28`,
                borderRadius: 8,
                padding: "3px 8px",
                fontSize: 9.5,
                fontWeight: 700,
                color: "#374151",
                backdropFilter: "blur(6px)",
                opacity: 0,
                animation: `specimenTagIn 0.3s cubic-bezier(0.16,1,0.3,1) ${0.15 + i * 0.07}s forwards`,
              }}>
                {tag}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Floating readout card (right side, post-price) ── */}
      <div style={{
        position: "absolute",
        right: -8,
        top: "50%",
        transform: showPrice
          ? "translateY(-50%) translateX(0) scale(1)"
          : "translateY(-50%) translateX(6px) scale(0.96)",
        opacity: showPrice ? 1 : 0,
        transition: "opacity 0.45s cubic-bezier(0.16,1,0.3,1), transform 0.45s cubic-bezier(0.16,1,0.3,1)",
        zIndex: 12,
      }}>
        <div style={{
          background: "rgba(255,255,255,0.96)",
          border: `1.5px solid ${item.color}28`,
          borderRadius: 14,
          padding: "12px 14px",
          boxShadow: `0 8px 32px rgba(15,23,42,0.1), 0 0 0 1px ${item.color}14`,
          minWidth: 118,
          backdropFilter: "blur(16px)",
        }}>
          {/* Valuation */}
          <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>
            Valuation
          </div>
          <div style={{
            fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1,
            color: "#0A2218", marginBottom: 10,
          }}>
            {item.price}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: `linear-gradient(90deg, ${item.color}30, transparent)`, marginBottom: 9 }} />

          {/* Grade */}
          <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>
            Grade
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
            {item.grade}
          </div>

          {/* Confidence bar */}
          <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>
            AI Confidence
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 4, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${confidence}%`,
                background: `linear-gradient(90deg, ${item.color}, ${item.color}CC)`,
                borderRadius: 99,
                boxShadow: `0 0 6px ${item.color}60`,
                transition: "width 0.05s linear",
              }} />
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: item.color, minWidth: 28, textAlign: "right" }}>
              {confidence}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Object index dots ── */}
      <div style={{
        position: "absolute",
        bottom: -2,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 5,
        zIndex: 6,
      }}>
        {SPECIMEN_ITEMS.map((s, i) => (
          <div key={s.id} style={{
            width: i === itemIdx ? 14 : 5,
            height: 5,
            borderRadius: 99,
            background: i === itemIdx ? item.color : "rgba(0,0,0,0.14)",
            transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Section 1: Hero ───────────────────────────────────────────────────────────

function HeroSection({
  displayName,
}: {
  displayName: string;
}) {
  return (
    <section style={{
      position: "relative", overflow: "hidden",
      /* Rich green-tinted gradient — not white, not dark */
      background: "linear-gradient(140deg, #EDFAF4 0%, #D4F1E4 30%, #E8F4FF 65%, #EEE8FF 100%)",
      border: "1.5px solid #B8E6D0",
      borderRadius: 28, padding: "42px 36px 38px",
    }}>
      {/* Decorative radial blobs */}
      <div style={{
        position: "absolute", top: -120, right: -90,
        width: 420, height: 420, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -100, left: "15%",
        width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(109,40,217,0.09) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "25%", left: -80,
        width: 260, height: 260, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(2,132,199,0.08) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative" }}>
        {/* Status badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 9,
          background: "rgba(5,150,105,0.12)", border: "1.5px solid rgba(5,150,105,0.32)",
          borderRadius: 999, padding: "7px 16px 7px 11px",
          fontSize: 11.5, fontWeight: 700, color: "#065F46",
          letterSpacing: "0.06em", marginBottom: 26, textTransform: "uppercase",
        }}>
          <LivePulse color="#059669" />
          ScrapIQ Command Center
          <span style={{
            width: 1, height: 12, background: "rgba(5,150,105,0.35)", display: "inline-block",
          }} />
          <span style={{ color: "#059669", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>
            Intelligence Active
          </span>
        </div>

        <div className="hero-grid" style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 32, alignItems: "center",
        }}>
          {/* Left column */}
          <div>
            <h1 style={{
              fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900,
              letterSpacing: "-0.04em", lineHeight: 1.15,
              color: "#0A2218", marginBottom: 10,
            }}>
              Welcome back, {displayName} 👋
            </h1>
            <p style={{
              fontSize: 15, fontWeight: 600, color: "#1E4D38",
              letterSpacing: "0.01em", marginBottom: 26,
            }}>
              Today&apos;s Intelligence Summary
            </p>

            {/* AI narrative lines */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 32, maxWidth: 530 }}>
              {AI_SUMMARY_LINES.map((line, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px",
                    background: "rgba(255,255,255,0.72)",
                    border: "1.5px solid rgba(5,150,105,0.18)",
                    borderRadius: 14,
                    backdropFilter: "blur(4px)",
                    opacity: 0,
                    animation: `dReveal 0.5s cubic-bezier(0.16,1,0.3,1) forwards`,
                    animationDelay: `${0.18 + i * 0.09}s`,
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{line.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0A2218" }}>
                      {line.material}
                    </span>
                    <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
                      {" "}— {line.text}
                    </span>
                  </div>
                  {/* Trend dot */}
                  <span style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 800,
                    padding: "3px 9px", borderRadius: 999,
                    background: line.trend === "up" ? "#D1FAE5" : "#F3F4F6",
                    color: line.trend === "up" ? "#065F46" : "#6B7280",
                    border: line.trend === "up" ? "1px solid rgba(5,150,105,0.3)" : "1px solid #E5E7EB",
                  }}>
                    {line.trend === "up" ? "↑ Rising" : "→ Stable"}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link
              href="/upload"
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "14px 28px",
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                color: "#fff", fontSize: 15, fontWeight: 700,
                borderRadius: 15, textDecoration: "none",
                boxShadow: "0 8px 28px rgba(5,150,105,0.38), 0 2px 6px rgba(5,150,105,0.2)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 16px 36px rgba(5,150,105,0.48), 0 4px 10px rgba(5,150,105,0.25)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 8px 28px rgba(5,150,105,0.38), 0 2px 6px rgba(5,150,105,0.2)";
              }}
            >
              Analyze New Scrap
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          {/* Right: Scrap Intelligence Engine */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ScrapIntelligenceEngine />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Section 2: Intelligence Metrics ──────────────────────────────────────────

interface MetricConfig {
  icon: string;
  label: string;
  value: string;
  color: string;
  bg: string;
  border: string;
  accent: string;
}

function MetricCard({ icon, label, value, color, bg, border, accent }: MetricConfig) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className={styles.metricCard}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? bg : "#FFFFFF",
        border: `1.5px solid ${hov ? border : "#E0EDE6"}`,
        boxShadow: hov
          ? `0 16px 40px ${color}1A, 0 4px 12px ${color}10`
          : "0 1px 4px rgba(15,23,42,0.05)",
      }}
    >
      {/* Icon */}
      <div style={{
        width: 46, height: 46, borderRadius: 15, marginBottom: 18,
        background: `linear-gradient(135deg, ${bg} 0%, ${color}22 100%)`,
        border: `1.5px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 21,
        boxShadow: hov ? `0 6px 18px ${color}28` : undefined,
        transition: "box-shadow 0.22s ease, transform 0.22s ease",
        transform: hov ? "scale(1.08) rotate(-4deg)" : undefined,
      }}>
        {icon}
      </div>

      {/* Value */}
      <div style={{
        fontSize: 27, fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1,
        marginBottom: 7,
        background: hov ? `linear-gradient(135deg, ${accent} 0%, ${color} 100%)` : undefined,
        WebkitBackgroundClip: hov ? "text" : undefined,
        WebkitTextFillColor: hov ? "transparent" : undefined,
        color: hov ? undefined : "#0F172A",
        transition: "color 0.22s ease",
      }}>
        {value}
      </div>

      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>{label}</div>

      {/* Animated bottom accent */}
      <div style={{
        height: 3, borderRadius: 99, marginTop: 18,
        background: `linear-gradient(90deg, ${color} 0%, ${color}40 100%)`,
        transformOrigin: "left",
        transform: hov ? "scaleX(1)" : "scaleX(0.35)",
        transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1)",
      }} />
    </div>
  );
}

function MetricsSection({
  animAnalyses, animAvgPrice, animTotalValue, aiAccuracy, insights, loading,
}: {
  animAnalyses: number; animAvgPrice: number; animTotalValue: number;
  aiAccuracy: number; insights: ReturnType<typeof generateInsights>; loading: boolean;
}) {
  return (
    <section style={{
      background: "#F7FDF9",
      border: "1.5px solid #C8E8D8",
      borderRadius: 24, padding: "26px 24px",
    }}>
      <ZoneLabel icon="📊" text="Intelligence Metrics" color="#059669" />
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
        gap: 12,
      }}>
        <MetricCard
          icon="🔬" label="Total Analyses"
          value={loading ? "—" : animAnalyses.toLocaleString("en-IN")}
          color="#059669" accent="#10B981"
          bg="#D1FAE5" border="rgba(5,150,105,0.32)"
        />
        <MetricCard
          icon="🎯" label="AI Accuracy"
          value={`${aiAccuracy}%`}
          color="#6D28D9" accent="#7C3AED"
          bg="#EDE9FE" border="rgba(109,40,217,0.32)"
        />
        <MetricCard
          icon="₹" label="Avg Valuation"
          value={loading ? "—" : `₹${animAvgPrice.toLocaleString("en-IN")}`}
          color="#B45309" accent="#D97706"
          bg="#FEF3C7" border="rgba(180,83,9,0.32)"
        />
        <MetricCard
          icon="📦" label="Most Analyzed"
          value={insights.mostAnalyzedMaterial?.material ?? "—"}
          color="#0284C7" accent="#0EA5E9"
          bg="#DBEAFE" border="rgba(2,132,199,0.32)"
        />
      </div>
    </section>
  );
}

// ── Section 3: AI Confidence Feed ────────────────────────────────────────────

function FeedItem({ item }: { item: typeof INSIGHT_FEED[0] }) {
  const [expanded, setExpanded] = useState(false);
  const priorityBadge: Record<string, { bg: string; color: string; border: string }> = {
    HIGH: { bg: "#FEE2E2", color: "#B91C1C", border: "rgba(185,28,28,0.25)" },
    MED:  { bg: "#FEF3C7", color: "#92400E", border: "rgba(146,64,14,0.25)" },
    LOW:  { bg: "#DBEAFE", color: "#1E40AF", border: "rgba(30,64,175,0.25)" },
  };
  const pb = priorityBadge[item.priority] || priorityBadge.LOW;

  return (
    <div
      className={styles.feedItem}
      onClick={() => setExpanded(e => !e)}
      style={{
        border: `1.5px solid ${expanded ? item.categoryColor + "40" : "#E0EDE6"}`,
        boxShadow: expanded ? `0 8px 28px ${item.categoryColor}14` : "0 1px 4px rgba(15,23,42,0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Category icon */}
        <div style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: item.categorySurface,
          border: `1.5px solid ${item.categoryBorder}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 19,
          boxShadow: expanded ? `0 4px 14px ${item.categoryColor}20` : undefined,
          transition: "box-shadow 0.2s ease",
        }}>
          {item.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title + priority */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", lineHeight: 1.3 }}>
              {item.title}
            </span>
            <span style={{
              fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
              background: pb.bg, color: pb.color, border: `1px solid ${pb.border}`,
              letterSpacing: "0.06em",
            }}>
              {item.priority}
            </span>
          </div>

          {/* Expandable description */}
          {expanded && (
            <p style={{
              fontSize: 13, color: "#475569", lineHeight: 1.7,
              margin: "0 0 14px",
              animation: "dFadeSlide 0.22s ease both",
            }}>
              {item.desc}
            </p>
          )}

          {/* Confidence bar + score */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 600, flexShrink: 0 }}>
              Confidence
            </span>
            <AnimBar value={item.confidence} color={item.categoryColor} height={5} delay={300} />
            <span style={{
              fontSize: 12.5, fontWeight: 800, color: item.categoryColor,
              flexShrink: 0, minWidth: 32,
            }}>
              {item.confidence}%
            </span>
          </div>
        </div>

        {/* Right meta + expand toggle */}
        <div style={{ flexShrink: 0, textAlign: "right", paddingTop: 2 }}>
          <div style={{ fontSize: 10.5, color: "#94A3B8", marginBottom: 7, whiteSpace: "nowrap" }}>
            {item.timestamp}
          </div>
          <div style={{
            fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
            background: item.categorySurface, color: item.categoryColor,
            border: `1px solid ${item.categoryBorder}`,
            whiteSpace: "nowrap",
          }}>
            {item.category}
          </div>
          <div style={{
            fontSize: 11, color: "#94A3B8", marginTop: 9, textAlign: "center",
            transition: "transform 0.22s ease",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            display: "block",
          }}>
            ▾
          </div>
        </div>
      </div>
    </div>
  );
}

function AIFeedSection({ analyses }: { analyses: AnalysisRecord[] }) {
  return (
    <section style={{
      background: "#F5F3FF",
      border: "1.5px solid #DDD6FE",
      borderRadius: 24, padding: "26px 24px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <ZoneLabel icon="🧠" text="AI Confidence Feed" color="#6D28D9" live />
        <div style={{
          fontSize: 11, fontWeight: 600, color: "#7C3AED",
          background: "rgba(109,40,217,0.08)", border: "1px solid rgba(109,40,217,0.2)",
          borderRadius: 999, padding: "4px 12px", marginBottom: 20,
        }}>
          Tap to expand ↓
        </div>
      </div>

      {analyses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 16px" }}>
          <div style={{ fontSize: 36, marginBottom: 12, animation: "dFloat 3s ease-in-out infinite" }}>📈</div>
          <p style={{ color: "#7C3AED", fontSize: 13.5, fontWeight: 500 }}>
            Start analyzing items to unlock personalized AI insights
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {INSIGHT_FEED.map(item => (
            <FeedItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Section 4: Quick Actions ──────────────────────────────────────────────────

function QuickActionCard({ action }: { action: QuickAction }) {
  const [hov, setHov] = useState(false);
  return (
    <Link
      href={action.href}
      className={styles.actionCard}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? action.surface : "#FFFFFF",
        border: `1.5px solid ${hov ? action.borderColor : "#E0EDE6"}`,
        boxShadow: hov
          ? `0 20px 48px ${action.color}1C, 0 4px 14px ${action.color}12`
          : "0 1px 4px rgba(15,23,42,0.05)",
      }}
    >
      {/* Icon */}
      <div style={{
        width: 52, height: 52, borderRadius: 17, marginBottom: 18,
        background: `linear-gradient(135deg, ${action.surface} 0%, ${action.color}25 100%)`,
        border: `1.5px solid ${action.borderColor}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 25,
        transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease",
        transform: hov ? "scale(1.12) rotate(-7deg)" : undefined,
        boxShadow: hov ? `0 8px 22px ${action.color}30` : undefined,
      }}>
        {action.icon}
      </div>

      <div style={{ fontSize: 15.5, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
        {action.title}
      </div>
      <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.65, marginBottom: 22 }}>
        {action.desc}
      </div>

      {/* CTA pill */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 12.5, fontWeight: 700, color: action.color,
        padding: "6px 15px", borderRadius: 999,
        background: action.surface, border: `1.5px solid ${action.borderColor}`,
        transition: "padding-right 0.2s ease",
      }}>
        Open
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{
            transition: "transform 0.2s ease",
            transform: hov ? "translateX(4px)" : undefined,
          }}
        >
          <path d="M1.5 6h9M6.5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Link>
  );
}

function QuickActionsSection() {
  return (
    <section style={{
      background: "#EFF9FF",
      border: "1.5px solid #BAE6FD",
      borderRadius: 24, padding: "26px 24px",
    }}>
      <ZoneLabel icon="⚡" text="Quick Actions" color="#0284C7" />
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))",
        gap: 12,
      }}>
        {QUICK_ACTIONS.map(a => (
          <QuickActionCard key={a.href} action={a} />
        ))}
      </div>
    </section>
  );
}

// ── Section 5: Activity Timeline — PRESERVED EXACTLY ─────────────────────────

function ActivityTimeline({
  activity, router,
}: {
  activity: Activity[];
  router: ReturnType<typeof useRouter>;
}) {
  if (activity.length === 0) {
    return (
      <div style={{
        textAlign: "center", padding: "40px 16px", color: "#94A3B8",
        background: "#FFFFFF", border: "1.5px solid #DCEAE2", borderRadius: 20,
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
        <p style={{ fontSize: 13 }}>No activity yet — start your first analysis</p>
      </div>
    );
  }

  return (
    <div style={{
      background: "#FFFFFF", border: "1.5px solid #DCEAE2",
      borderRadius: 20, padding: "6px 20px",
    }}>
      {activity.map((item, i) => {
        const isEmpty = item.id === "1";
        const isLast  = i === activity.length - 1;
        return (
          <div
            key={item.id}
            className={styles.timelineRow}
            onClick={() => { if (!isEmpty) router.push(`/history?open=${item.id}`); }}
            style={{
              borderBottom: !isLast ? "1px solid #F1F5F9" : "none",
              cursor: isEmpty ? "default" : "pointer",
            }}
          >
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11, zIndex: 1,
                background: i === 0 ? "rgba(16,185,129,0.14)" : "#F2FBF7",
                border: `1.5px solid ${i === 0 ? "rgba(16,185,129,0.32)" : "#DCEAE2"}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
              }}>
                {isEmpty ? "✨" : materialEmoji(item.material ?? null)}
              </div>
              {!isLast && (
                <div style={{
                  position: "absolute", top: 36, bottom: -15, width: 1.5,
                  background: "linear-gradient(to bottom, #DCEAE2, transparent)",
                }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingTop: 5 }}>
              <div style={{
                fontSize: 13.5, fontWeight: 700, color: "#0F172A",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3,
              }}>
                {item.title}
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>{item.time}</div>
            </div>
            <div style={{
              fontSize: 13, fontWeight: 800, color: "#10B981",
              flexShrink: 0, paddingTop: 5,
              background: "#EAF8F1", borderRadius: 8, padding: "4px 10px",
            }}>
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Section 6: Environmental Impact ──────────────────────────────────────────

function ImpactTile({
  emoji, value, label, color, surface, border,
}: {
  emoji: string; value: string; label: string;
  color: string; surface: string; border: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className={styles.impactTile}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.62)",
        border: `1.5px solid ${hov ? border : "rgba(5,150,105,0.2)"}`,
        boxShadow: hov ? `0 12px 32px ${color}1A` : undefined,
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 10, animation: "dFloat 3.5s ease-in-out infinite" }}>{emoji}</div>
      <div style={{
        fontSize: 24, fontWeight: 900, color,
        letterSpacing: "-0.03em", marginBottom: 5,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function EnvironmentalSection({
  impact, hasData, sustainScore, animCo2,
}: {
  impact: ReturnType<typeof calculateEnvironmentalImpact>;
  hasData: boolean; sustainScore: number; animCo2: number;
}) {
  return (
    <section style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(140deg, #ECFDF5 0%, #D1FAE5 30%, #E0F4FF 70%, #FEF3C7 100%)",
      border: "1.5px solid #6EE7B7",
      borderRadius: 24, padding: "32px 28px",
    }}>
      {/* Blobs */}
      <div style={{
        position: "absolute", top: -90, right: -70,
        width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(5,150,105,0.16) 0%, transparent 68%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -80, left: "20%",
        width: 260, height: 260, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(2,132,199,0.1) 0%, transparent 68%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "30%", right: "25%",
        width: 200, height: 200, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(180,83,9,0.07) 0%, transparent 68%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative" }}>
        <ZoneLabel icon="🌍" text="Impact Intelligence Center" color="#065F46" />

        {!hasData ? (
          <div style={{ textAlign: "center", padding: "36px 12px" }}>
            <div style={{ fontSize: 44, marginBottom: 14, animation: "dFloat 3s ease-in-out infinite" }}>♻️</div>
            <p style={{ color: "#065F46", fontSize: 14, maxWidth: 300, margin: "0 auto", fontWeight: 500 }}>
              Start analyzing items to track your environmental contribution
            </p>
          </div>
        ) : !impact.totalWeight ? (
          <div style={{ textAlign: "center", padding: "28px" }}>
            <p style={{ color: "#475569", fontSize: 13.5 }}>
              Weight data will appear as you analyze items
            </p>
          </div>
        ) : (
          <>
            <h2 style={{
              fontSize: "clamp(18px, 2.8vw, 26px)", fontWeight: 800,
              color: "#022C22", lineHeight: 1.38, margin: "0 0 28px",
              maxWidth: 600,
            }}>
              Your recycling is equivalent to planting{" "}
              <span style={{ color: "#059669" }}>{impact.treesEquivalent} trees</span> 🌳
            </h2>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 12, marginBottom: 28,
            }}>
              <ImpactTile emoji="🌳" value={String(impact.treesEquivalent)} label="Trees Saved"    color="#065F46" surface="#D1FAE5" border="rgba(5,150,105,0.35)" />
              <ImpactTile emoji="💨" value={`${animCo2}kg`}                  label="CO₂ Reduced"   color="#0284C7" surface="#DBEAFE" border="rgba(2,132,199,0.35)" />
              <ImpactTile emoji="⚖️" value={`${impact.totalWeight}kg`}        label="Recycled"      color="#B45309" surface="#FEF3C7" border="rgba(180,83,9,0.35)"  />
              <ImpactTile emoji="🏅" value={String(sustainScore)}             label="Sustain Score" color="#059669" surface="#D1FAE5" border="rgba(5,150,105,0.35)" />
            </div>

            {/* Sustainability score bar */}
            <div style={{
              background: "rgba(255,255,255,0.68)",
              border: "1.5px solid rgba(5,150,105,0.22)",
              borderRadius: 18, padding: "20px 22px",
              backdropFilter: "blur(4px)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#022C22" }}>
                  Sustainability Score
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 900, color: "#059669",
                  background: "#D1FAE5", borderRadius: 999, padding: "3px 12px",
                  border: "1px solid rgba(5,150,105,0.25)",
                }}>
                  {sustainScore} / 100
                </span>
              </div>
              <AnimBar value={sustainScore} color="#059669" height={8} delay={400} />
              <p style={{ fontSize: 11.5, color: "#6B7280", marginTop: 12, fontWeight: 500 }}>
                Every kilogram recycled grows your impact score. Keep going.
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats]       = useState<StatCard[]>([
    { label: "Analyses", value: "—" },
    { label: "Avg Price", value: "—" },
    { label: "Total Value", value: "—" },
  ]);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [activity, setActivity] = useState<Activity[]>([
    { id: "1", title: "No recent analysis yet", time: "Start by uploading an image", value: "→" },
  ]);
  const [loading, setLoading]       = useState(false);
  const [statsReady, setStatsReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (authLoading || !user) return;
      setLoading(true);
      try {
        const history      = await fetchHistory();
        const analysesData = history.analyses || [];
        setAnalyses(analysesData);

        const validPrices = analysesData
          .filter((a: AnalysisRecord) => a.final_price && !isNaN(a.final_price))
          .map((a: AnalysisRecord) => a.final_price as number);

        const totalValue = validPrices.reduce((s: number, p: number) => s + p, 0);
        const avgPrice   = validPrices.length > 0 ? totalValue / validPrices.length : 0;

        setStats([
          { label: "Analyses",    value: analysesData.length.toString() },
          { label: "Avg Price",   value: formatPrice(avgPrice) },
          { label: "Total Value", value: formatPrice(totalValue) },
        ]);
        setStatsReady(true);

        const recent: Activity[] = analysesData.slice(0, 5).map((r: AnalysisRecord) => ({
          id:       r.id,
          title:    r.material || r.category || "Scrap",
          time:     formatDate(r.created_at),
          value:    formatPrice(r.final_price),
          material: r.material,
        }));
        setActivity(recent.length > 0
          ? recent
          : [{ id: "1", title: "No recent analysis yet", time: "Start by uploading an image", value: "→" }]);
      } catch (e) {
        console.error("[Dashboard]", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, authLoading]);

  const displayName = getUserDisplayName(user);

  const totalAnalysesNum = useMemo(() => {
    const v = stats[0]?.value;
    return v === "—" ? 0 : parseInt(v as string, 10) || 0;
  }, [stats]);

  const avgPriceNum = useMemo(() => {
    const vp = analyses
      .filter(a => a.final_price && !isNaN(a.final_price))
      .map(a => a.final_price as number);
    return vp.length > 0 ? vp.reduce((s, p) => s + p, 0) / vp.length : 0;
  }, [analyses]);

  const totalValueNum = useMemo(() =>
    analyses
      .filter(a => a.final_price && !isNaN(a.final_price))
      .reduce((s, a) => s + (a.final_price as number), 0),
  [analyses]);

  const co2SavedNum = useMemo(() => {
    let t = 0;
    analyses.forEach(a => {
      if (a.weight)
        t += a.weight * ((a.material || "").toLowerCase().includes("plastic") ? 0.5 : 2);
    });
    return Math.round(t * 10) / 10;
  }, [analyses]);

  const animAnalyses   = useCountUp(totalAnalysesNum,          statsReady);
  const animAvgPrice   = useCountUp(Math.round(avgPriceNum),   statsReady);
  const animTotalValue = useCountUp(Math.round(totalValueNum), statsReady);
  const animCo2        = useCountUp(Math.round(co2SavedNum),   statsReady);

  const insights     = useMemo(() => generateInsights(analyses), [analyses]);
  const impact       = useMemo(() => calculateEnvironmentalImpact(analyses), [analyses]);

  const marketUp     = useMemo(() => MOCK_MARKET_PRICES.filter(m => m.trend === "up"), []);
  const bestMaterial = marketUp[0] ?? MOCK_MARKET_PRICES[0];

  const aiAccuracy   = insights.totalAnalyses > 0 ? Math.min(96, 70 + insights.totalAnalyses) : 72;
  const sustainScore = impact.totalWeight > 0
    ? Math.min(100, Math.round(35 + impact.co2Saved * 2.4 + totalAnalysesNum * 3))
    : 0;

  return (
    <div className={styles.canvas}>
      <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* 1 — HERO */}
        <div className={`${styles.reveal} ${styles.delay1}`}>
          <HeroSection
            displayName={displayName}
          />
        </div>

        {/* 2 — INTELLIGENCE METRICS */}
        <div className={`${styles.reveal} ${styles.delay2}`}>
          <MetricsSection
            animAnalyses={animAnalyses}
            animAvgPrice={animAvgPrice}
            animTotalValue={animTotalValue}
            aiAccuracy={aiAccuracy}
            insights={insights}
            loading={loading}
          />
        </div>

        {/* 3 — AI CONFIDENCE FEED */}
        <div className={`${styles.reveal} ${styles.delay3}`}>
          <AIFeedSection analyses={analyses} />
        </div>

        {/* 4 — QUICK ACTIONS */}
        <div className={`${styles.reveal} ${styles.delay4}`}>
          <QuickActionsSection />
        </div>

        {/* 5 — ACTIVITY TIMELINE — PRESERVED */}
        <div className={`${styles.reveal} ${styles.delay5}`}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Activity Timeline</span>
              <div style={{ flex: 1, height: 1, background: "#D1EDE0" }} />
            </div>
            <Link href="/history" style={{
              fontSize: 12, fontWeight: 700, color: "#059669",
              textDecoration: "none", marginLeft: 16, flexShrink: 0,
              padding: "6px 14px",
              background: "#D1FAE5", border: "1px solid rgba(5,150,105,0.3)",
              borderRadius: 999,
            }}>
              View All →
            </Link>
          </div>
          <ActivityTimeline activity={activity} router={router} />
        </div>

        {/* 6 — ENVIRONMENTAL IMPACT */}
        <div className={`${styles.reveal} ${styles.delay6}`}>
          <EnvironmentalSection
            impact={impact}
            hasData={analyses.length > 0}
            sustainScore={sustainScore}
            animCo2={animCo2}
          />
        </div>

      </div>

      {/* Global keyframes */}
      <style>{`
        @keyframes dReveal {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes dRipple {
          0%   { transform: scale(0.7); opacity: 0.5; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes dFadeSlide {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dPulse {
          0%, 100% { opacity: 1;   transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.7); }
        }

        /* ── Specimen viewer keyframes ── */

        /* Scan beam sweeps from top (8%) to bottom (88%) over 1.6s */
        @keyframes specimenBeam {
          0%   { top: 8%;  opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { top: 88%; opacity: 0; }
        }

        /* Tags slide up and fade in */
        @keyframes specimenTagIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Analysis overlay lines fade in */
        @keyframes specimenFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @media (max-width: 767px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .engine-container { display: none !important; }
        }
      `}</style>
    </div>
  );
}