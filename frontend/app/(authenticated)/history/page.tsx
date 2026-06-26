"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  fetchHistory,
  submitFeedback,
  deleteAnalysis,
  togglePin,
  type AnalysisRecord,
} from "@/lib/api";
import { exportToJSON, exportToCSV, timestampedFilename } from "@/lib/historyHelpers";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  mint:       "#F2FBF7",
  softGreen:  "#EAF8F1",
  copper:     "#FFF7F1",
  lavender:   "#F8F4FF",
  sky:        "#F0FAFF",
  white:      "#FFFFFF",
  border:     "#DCEAE2",
  green:      "#10B981",
  emerald:    "#059669",
  muted:      "#64748B",
  text:       "#0F172A",
  subtle:     "#94A3B8",
  amber:      "#D97706",
  violet:     "#8B5CF6",
  sky2:       "#38BDF8",
  red:        "#EF4444",
};

// ─── Pure helpers (unchanged logic) ──────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(new Date(iso));
  } catch { return iso; }
}

function formatDateShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    }).format(new Date(iso));
  } catch { return iso; }
}

function capitalize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");
}

function materialEmoji(m: string | null): string {
  switch (m?.toLowerCase()) {
    case "copper":   return "🟤";
    case "aluminum": return "⚪";
    case "iron":     return "⚙️";
    case "steel":    return "🔩";
    case "plastic":  return "♻️";
    default:         return "📦";
  }
}

function materialColor(m: string | null): { surface: string; border: string; accent: string } {
  switch (m?.toLowerCase()) {
    case "copper":   return { surface: "#FFF7F1", border: "#FDDCBF", accent: "#C2410C" };
    case "aluminum": return { surface: "#F0FAFF", border: "#BAE6FD", accent: "#0284C7" };
    case "steel":    return { surface: "#F8FAFC", border: "#CBD5E1", accent: "#475569" };
    case "iron":     return { surface: "#F1F5F9", border: "#CBD5E1", accent: "#334155" };
    case "plastic":  return { surface: "#F2FBF7", border: "#A7F3D0", accent: "#059669" };
    default:         return { surface: "#F8FAFC", border: "#E2E8F0", accent: "#64748B" };
  }
}

function confidenceColor(level: string | null) {
  switch (level?.toLowerCase()) {
    case "high":   return { color: "#059669", bg: "#D1FAE5", border: "rgba(5,150,105,0.3)" };
    case "medium": return { color: "#D97706", bg: "#FEF3C7", border: "rgba(217,119,6,0.3)"  };
    case "low":    return { color: "#DC2626", bg: "#FEE2E2", border: "rgba(220,38,38,0.3)"  };
    default:       return { color: "#64748B", bg: "#F1F5F9", border: "rgba(100,116,139,0.3)" };
  }
}

function calculateStats(records: AnalysisRecord[]) {
  if (records.length === 0) return { totalAnalyses: 0, totalWeight: 0, totalValue: 0, highestValue: 0, mostMaterial: "—", avgValue: 0 };
  const totalWeight = records.reduce((s, r) => s + (r.weight ?? 0), 0);
  const prices = records.map(r => r.final_price ?? 0);
  const totalValue  = prices.reduce((s, p) => s + p, 0);
  const highestValue = Math.max(...prices);
  const avgValue = totalValue / records.length;
  const materialCounts: Record<string, number> = {};
  records.forEach(r => { if (r.material) materialCounts[r.material] = (materialCounts[r.material] ?? 0) + 1; });
  const mostMaterial = Object.entries(materialCounts).length > 0
    ? Object.entries(materialCounts).sort((a, b) => b[1] - a[1])[0][0] : "—";
  return { totalAnalyses: records.length, totalWeight, totalValue, highestValue, mostMaterial, avgValue };
}

function extractUniqueValues(records: AnalysisRecord[], field: keyof AnalysisRecord) {
  const values = new Set<string>();
  records.forEach(r => { const v = r[field]; if (v && typeof v === "string") values.add(v); });
  return Array.from(values).sort();
}

function applyFiltersAndSearch(records: AnalysisRecord[], search: string, filters: Record<string, string | null>): AnalysisRecord[] {
  return records.filter(record => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (![record.material, record.subtype, record.category].some(f => f?.toLowerCase().includes(q))) return false;
    }
    if (filters.material   && record.material         !== filters.material)   return false;
    if (filters.condition  && record.condition        !== filters.condition)  return false;
    if (filters.cleanliness && record.cleanliness     !== filters.cleanliness) return false;
    if (filters.confidence && record.confidence_level !== filters.confidence) return false;
    return true;
  });
}

function sortRecords(records: AnalysisRecord[], sortBy: string): AnalysisRecord[] {
  const sorted = [...records];
  switch (sortBy) {
    case "newest":  sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    case "oldest":  sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
    case "highest": sorted.sort((a, b) => (b.final_price ?? 0) - (a.final_price ?? 0)); break;
    case "lowest":  sorted.sort((a, b) => (a.final_price ?? 0) - (b.final_price ?? 0)); break;
  }
  return sorted.sort((a, b) => { if (a.is_pinned === b.is_pinned) return 0; return a.is_pinned ? -1 : 1; });
}

function generateAIInsight(record: AnalysisRecord): string {
  const material    = record.material?.toLowerCase() || "";
  const condition   = record.condition?.toLowerCase() || "";
  const cleanliness = record.cleanliness?.toLowerCase() || "";
  const insights: Record<string, (c: string, cl: string) => string> = {
    copper:   (c, cl) => cl === "dirty" ? "Copper requires cleaning for optimal resale. Light cleaning can increase pricing by 10–15%." : c === "excellent" ? "Excellent copper retains near full market value. High demand in electrical industries." : `${capitalize(c)} copper has good resale potential.`,
    aluminum: (c)     => c === "good" || c === "excellent" ? "Aluminum in good condition is highly recyclable with consistent market demand." : "Aluminum has stable recycling value across various conditions.",
    plastic:  (_, cl) => cl === "dirty" ? "Dirty plastic reduces recycling efficiency significantly. Cleaning improves value." : "Plastic recycling value depends heavily on type separation and cleanliness.",
    steel:    ()      => (record.weight ?? 0) > 50 ? "Heavy steel scrap may provide better bulk resale value. Consider volume consolidation." : "Steel scrap is versatile with consistent market demand.",
    iron:     ()      => "Iron scrap provides stable recycling value. Bulk sales often yield better per-kg rates.",
  };
  return insights[material]?.(condition, cleanliness) || (record.confidence_level === "high" ? "High confidence analysis — valuation is reliable for market transactions." : "Analysis shows solid recycling potential. Current market rates are favorable.");
}

function calculateEnvironmentalImpact(record: AnalysisRecord) {
  const weight = record.weight ?? 0;
  return { weight, co2Saved: Math.round(weight * 2.5 * 10) / 10, treesSaved: Math.round(weight * 0.0083 * 100) / 100 };
}

function generateRecommendations(record: AnalysisRecord): string[] {
  const recs: string[] = [];
  const cond  = record.condition?.toLowerCase() || "";
  const clean = record.cleanliness?.toLowerCase() || "";
  const mat   = record.material?.toLowerCase() || "";
  if (cond === "fair"  || cond  === "poor")        recs.push("Consider cleaning or refurbishing to improve condition and value.");
  if (clean === "dirty" || clean === "very_dirty")  recs.push("Cleaning this material could increase resale value by 10–20%.");
  if (mat === "copper"  || mat  === "aluminum")     recs.push("Consider selling to specialized electronics recyclers for premium rates.");
  if (mat === "plastic")                            recs.push("Separate by plastic type (PET, HDPE, etc.) to maximize recycling value.");
  if ((mat === "steel" || mat === "iron") && (record.weight ?? 0) > 100) recs.push("Large quantity detected. Bulk sales to scrap yards may yield better rates.");
  if ((record.final_price ?? 0) < 100)             recs.push("Consider consolidating with other items for more efficient selling.");
  if ((record.weight ?? 0) < 5)                    recs.push("Small quantity. Combining with other analyses could reduce transaction overhead.");
  return recs.length > 0 ? recs : ["Current analysis shows fair market value. Ready for sale."];
}

function generateValuationExplanation(record: AnalysisRecord): string {
  const material  = capitalize(record.material) || "Material";
  const condition = capitalize(record.condition) || "average condition";
  const weight    = record.weight ? `${record.weight} kg` : "the measured weight";
  const price     = record.final_price ? `₹${record.final_price}` : "the estimated value";
  return `This valuation of ${price} for ${weight} of ${material} in ${condition} is based on current market rates, material quality assessment, and recycling industry standards. The estimate factors in purity levels, processing costs, and regional market demand.`;
}

// ─── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, active: boolean, duration = 1200) {
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

// ─── AnimBar ──────────────────────────────────────────────────────────────────

function AnimBar({ value, color, height = 5 }: { value: number; color: string; height?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 250); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ height, background: "rgba(0,0,0,0.07)", borderRadius: 99, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 99, transition: "width 1.1s cubic-bezier(0.16,1,0.3,1)", boxShadow: `0 0 8px ${color}50` }} />
    </div>
  );
}

// ─── LivePulse ────────────────────────────────────────────────────────────────

function LivePulse({ color = T.green, size = 7 }: { color?: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: size + 4, height: size + 4 }}>
      <span style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: color, opacity: 0.3, animation: "dRipple 2s ease-out infinite" }} />
      <span style={{ width: size, height: size, borderRadius: "50%", background: color, display: "block" }} />
    </span>
  );
}

// ─── ZoneLabel ────────────────────────────────────────────────────────────────

function ZoneLabel({ icon, text, color, live }: { icon: string; text: string; color: string; live?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: `${color}12`, border: `1.5px solid ${color}28`, borderRadius: 999, padding: "5px 13px 5px 9px", fontSize: 11.5, fontWeight: 700, color, letterSpacing: "0.025em" }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      {text}
      {live && <LivePulse color={color} />}
    </div>
  );
}

// ─── Hero Stats ───────────────────────────────────────────────────────────────

function HeroStats({ stats, ready }: { stats: ReturnType<typeof calculateStats>; ready: boolean }) {
  const animAnalyses = useCountUp(stats.totalAnalyses,              ready);
  const animWeight   = useCountUp(Math.round(stats.totalWeight),    ready);
  const animValue    = useCountUp(Math.round(stats.totalValue),     ready);
  const animHighest  = useCountUp(Math.round(stats.highestValue),   ready);

  const cards = [
    { icon: "🔬", label: "Total Analyses",  value: animAnalyses.toLocaleString("en-IN"),       color: T.green,  surface: "#D1FAE5", border: "rgba(16,185,129,0.25)" },
    { icon: "⚖️", label: "Total Recycled",  value: `${animWeight} kg`,                         color: T.sky2,   surface: "#E0F2FE", border: "rgba(56,189,248,0.25)"  },
    { icon: "₹",  label: "Total Generated", value: `₹${animValue.toLocaleString("en-IN")}`,    color: T.amber,  surface: "#FEF3C7", border: "rgba(217,119,6,0.25)"   },
    { icon: "🏆", label: "Highest Value",   value: `₹${animHighest.toLocaleString("en-IN")}`,  color: T.violet, surface: "#EDE9FE", border: "rgba(139,92,246,0.25)"  },
    { icon: "📦", label: "Most Analyzed",   value: capitalize(stats.mostMaterial),              color: "#0284C7", surface: "#DBEAFE", border: "rgba(2,132,199,0.25)"  },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12 }}>
      {cards.map((c, i) => (
        <StatCard key={c.label} {...c} index={i} />
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, color, surface, border, index }: {
  icon: string; label: string; value: string; color: string; surface: string; border: string; index: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? surface : "#FFFFFF",
        border: `1.5px solid ${hov ? border : T.border}`,
        borderRadius: 18, padding: "18px 16px",
        transition: "all 0.22s cubic-bezier(0.16,1,0.3,1)",
        transform: hov ? "translateY(-3px)" : undefined,
        boxShadow: hov ? `0 12px 32px ${color}18` : "0 1px 4px rgba(15,23,42,0.05)",
        opacity: 0, animation: "dReveal 0.55s cubic-bezier(0.16,1,0.3,1) forwards",
        animationDelay: `${0.05 + index * 0.07}s`,
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 12, marginBottom: 14, background: surface, border: `1.5px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transition: "transform 0.22s ease", transform: hov ? "scale(1.1) rotate(-5deg)" : undefined }}>
        {icon}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: hov ? color : T.text, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 5, transition: "color 0.22s ease" }}>{value}</div>
      <div style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>{label}</div>
      <div style={{ height: 3, borderRadius: 99, marginTop: 12, background: `linear-gradient(90deg, ${color}, ${color}40)`, transform: hov ? "scaleX(1)" : "scaleX(0.3)", transformOrigin: "left", transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1)" }} />
    </div>
  );
}

// ─── Search + Filter Toolbar ──────────────────────────────────────────────────

interface ToolbarProps {
  search: string; setSearch: (v: string) => void;
  filters: Record<string, string | null>; onFilterChange: (f: string, v: string | null) => void;
  sortBy: string; setSortBy: (v: string) => void;
  availableValues: Record<string, string[]>;
  hasActiveFilters: boolean; onClearAll: () => void;
  totalCount: number; filteredCount: number;
  onExportCSV: () => void; onExportJSON: () => void;
}

function SearchToolbar({ search, setSearch, filters, onFilterChange, sortBy, setSortBy, availableValues, hasActiveFilters, onClearAll, totalCount, filteredCount, onExportCSV, onExportJSON }: ToolbarProps) {
  const [searchFocus, setSearchFocus] = useState(false);
  const selectStyle = {
    flex: "1 1 110px", minWidth: 100, padding: "9px 12px",
    background: "#FFFFFF", border: `1.5px solid ${T.border}`,
    borderRadius: 11, color: T.text, fontSize: 13, cursor: "pointer", outline: "none",
  };

  return (
    <div style={{ background: "#F7FDF9", border: `1.5px solid #C8E8D8`, borderRadius: 20, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <ZoneLabel icon="🔎" text="Intelligence Search Center" color={T.emerald} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onExportCSV} style={{ padding: "7px 14px", background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 10, color: T.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↓ CSV</button>
          <button onClick={onExportJSON} style={{ padding: "7px 14px", background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 10, color: T.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↓ JSON</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 15, pointerEvents: "none" }}>🔍</span>
        <input
          type="text" placeholder="Search by material, subtype, or category…"
          value={search} onChange={e => setSearch(e.target.value)}
          onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px 10px 40px", background: "#FFFFFF", border: `1.5px solid ${searchFocus ? T.green : T.border}`, borderRadius: 12, color: T.text, fontSize: 13.5, outline: "none", transition: "border-color 0.18s ease", boxShadow: searchFocus ? `0 0 0 3px rgba(16,185,129,0.1)` : undefined }}
        />
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {["material", "condition", "cleanliness", "confidence"].map(field => (
          <select key={field} value={filters[field] || ""} onChange={e => onFilterChange(field, e.target.value || null)}
            style={{ ...selectStyle, borderColor: filters[field] ? T.green : T.border, color: filters[field] ? T.green : T.text }}>
            <option value="">{capitalize(field)}</option>
            {(availableValues[field] || []).map(v => <option key={v} value={v}>{capitalize(v)}</option>)}
          </select>
        ))}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="highest">Highest Value</option>
          <option value="lowest">Lowest Value</option>
        </select>
      </div>

      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>
          {filteredCount} {filteredCount === 1 ? "analysis" : "analyses"}
          {hasActiveFilters && ` of ${totalCount} total`}
        </span>
        {hasActiveFilters && (
          <button onClick={onClearAll} style={{ padding: "5px 13px", background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 999, color: T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ✕ Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Analysis Modal ───────────────────────────────────────────────────────────

function AnalysisModal({ record, isOpen, onClose }: { record: AnalysisRecord; isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  const insight    = generateAIInsight(record);
  const env        = calculateEnvironmentalImpact(record);
  const recs       = generateRecommendations(record);
  const valuation  = generateValuationExplanation(record);
  const pal        = materialColor(record.material);
  const conf       = confidenceColor(record.confidence_level);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 24, maxWidth: 580, maxHeight: "88vh", width: "100%", overflow: "auto", boxShadow: "0 32px 80px rgba(15,23,42,0.18)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1.5px solid ${T.border}`, position: "sticky", top: 0, background: "#FFFFFF", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 15, background: pal.surface, border: `1.5px solid ${pal.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{materialEmoji(record.material)}</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>{capitalize(record.material)}</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{formatDate(record.created_at)}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: "#F1F5F9", border: "none", color: T.muted, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Key metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div style={{ background: "#EAF8F1", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Estimated Value</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: T.emerald, letterSpacing: "-0.03em" }}>{record.final_price !== null ? `₹${record.final_price}` : "—"}</div>
            </div>
            <div style={{ background: "#F0FAFF", border: "1.5px solid rgba(56,189,248,0.25)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Weight</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: T.sky2, letterSpacing: "-0.03em" }}>{record.weight !== null ? `${record.weight} kg` : "—"}</div>
            </div>
          </div>

          {/* Details grid */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Analysis Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {[
                { label: "Category",    value: capitalize(record.category)         },
                { label: "Subtype",     value: capitalize(record.subtype)           },
                { label: "Condition",   value: capitalize(record.condition)         },
                { label: "Cleanliness", value: capitalize(record.cleanliness)       },
                { label: "Confidence",  value: capitalize(record.confidence_level), color: conf.color, bg: conf.bg, border: conf.border },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} style={{ background: bg ?? "#F8FAFC", border: `1.5px solid ${border ?? T.border}`, borderRadius: 11, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9.5, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: color ?? T.text }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insight */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>🧠 AI Insight</div>
            <div style={{ background: "#F5F3FF", border: "1.5px solid rgba(139,92,246,0.22)", borderRadius: 14, padding: 16, fontSize: 13, color: "#4C1D95", lineHeight: 1.65, fontStyle: "italic" }}>{insight}</div>
          </div>

          {/* Valuation */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>💰 Valuation Explanation</div>
            <div style={{ background: "#FFFBEB", border: "1.5px solid rgba(217,119,6,0.22)", borderRadius: 14, padding: 16, fontSize: 13, color: "#78350F", lineHeight: 1.65 }}>{valuation}</div>
          </div>

          {/* Environmental impact */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>🌱 Environmental Impact</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "Material Recycled", value: `${env.weight} kg`, color: T.emerald, bg: "#D1FAE5" },
                { label: "CO₂ Saved",         value: `${env.co2Saved} kg`, color: T.sky2,   bg: "#E0F2FE" },
                { label: "Trees Saved",        value: String(env.treesSaved), color: "#059669", bg: "#D1FAE5" },
              ].map(t => (
                <div key={t.label} style={{ background: t.bg, border: `1.5px solid ${t.color}25`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{t.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: t.color }}>{t.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div style={{ marginBottom: record.summary ? 20 : 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>💡 Recommendations</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {recs.map((rec, i) => (
                <div key={i} style={{ background: "#F2FBF7", border: "1.5px solid rgba(16,185,129,0.2)", borderRadius: 11, padding: "10px 14px", fontSize: 13, color: "#064E3B", lineHeight: 1.55 }}>
                  <span style={{ color: T.green, fontWeight: 700, marginRight: 6 }}>→</span>{rec}
                </div>
              ))}
            </div>
          </div>

          {record.summary && (
            <div style={{ background: "#F8FAFC", border: `1.5px solid ${T.border}`, borderLeft: `4px solid ${T.green}`, borderRadius: "0 12px 12px 0", padding: "12px 16px", fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
              <span style={{ color: T.green, fontWeight: 700 }}>📋 Summary: </span>{record.summary}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1.5px solid ${T.border}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 24px", background: `linear-gradient(135deg, ${T.green}, ${T.emerald})`, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Feedback Widget ──────────────────────────────────────────────────────────

function FeedbackWidget({ analysisId }: { analysisId: string }) {
  const [voted, setVoted]       = useState<boolean | null>(null);
  const [note, setNote]         = useState("");
  const [showNote, setShowNote] = useState(false);
  const [sending, setSending]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  async function sendFeedback(isAccurate: boolean) {
    setSending(true); setError("");
    try {
      await submitFeedback({ analysis_id: analysisId, is_accurate: isAccurate, note: note.trim() || undefined });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send feedback");
    } finally { setSending(false); }
  }

  if (done) return <p style={{ color: T.green, fontSize: 12.5, marginTop: 12, fontWeight: 600 }}>✓ Thank you for your feedback!</p>;

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
      <p style={{ fontSize: 12, color: T.muted, marginBottom: 8, fontWeight: 500 }}>Was this estimate accurate?</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: "👍 Accurate",     val: true,  activeColor: T.green, activeBg: "#D1FAE5" },
          { label: "👎 Not accurate", val: false, activeColor: T.red,   activeBg: "#FEE2E2" },
        ].map(btn => (
          <button key={String(btn.val)} onClick={() => { setVoted(btn.val); setShowNote(true); }} disabled={sending}
            style={{ padding: "5px 14px", borderRadius: 999, border: `1.5px solid ${voted === btn.val ? btn.activeColor : T.border}`, background: voted === btn.val ? btn.activeBg : "#FFFFFF", color: voted === btn.val ? btn.activeColor : T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.18s ease" }}>
            {btn.label}
          </button>
        ))}
      </div>
      {showNote && voted !== null && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input type="text" placeholder="Optional note (e.g. actual price)" value={note} onChange={e => setNote(e.target.value)}
            style={{ flex: 1, padding: "7px 12px", background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 12.5, outline: "none" }} />
          <button onClick={() => sendFeedback(voted!)} disabled={sending}
            style={{ padding: "7px 16px", borderRadius: 10, border: "none", background: T.green, color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>
            {sending ? "…" : "Send"}
          </button>
        </div>
      )}
      {error && <p style={{ color: T.red, fontSize: 11.5, marginTop: 6 }}>{error}</p>}
    </div>
  );
}

// ─── Timeline Card ────────────────────────────────────────────────────────────

function TimelineCard({ record, defaultExpanded, onDelete, onPinToggle, isLast }: {
  record: AnalysisRecord; defaultExpanded?: boolean; isLast: boolean;
  onDelete: (id: string) => void; onPinToggle: (id: string, pinned: boolean) => void;
}) {
  const [expanded, setExpanded]       = useState(defaultExpanded ?? false);
  const [modalOpen, setModalOpen]     = useState(false);
  const [isPinned, setIsPinned]       = useState(record.is_pinned ?? false);
  const [pinLoading, setPinLoading]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [hov, setHov]                 = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const pal  = materialColor(record.material);
  const conf = confidenceColor(record.confidence_level);

  useEffect(() => {
    if (defaultExpanded && rowRef.current) {
      setTimeout(() => rowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [defaultExpanded]);

  async function handlePinToggle(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !isPinned; setIsPinned(next); setPinLoading(true);
    try { await togglePin(record.id, next); onPinToggle(record.id, next); }
    catch { setIsPinned(!next); }
    finally { setPinLoading(false); }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try { await deleteAnalysis(record.id); onDelete(record.id); }
    catch { setShowConfirm(false); }
    finally { setDeleteLoading(false); }
  }

  return (
    <div ref={rowRef} style={{ display: "flex", gap: 0, position: "relative" }}>
      {/* Timeline track */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 44, flexShrink: 0, paddingTop: 18 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: isPinned ? "#EAF8F1" : pal.surface,
          border: `2px solid ${isPinned ? T.green : pal.border}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, zIndex: 1,
          boxShadow: hov ? `0 4px 14px ${pal.accent}28` : undefined,
          transition: "box-shadow 0.2s ease",
        }}>
          {materialEmoji(record.material)}
        </div>
        {!isLast && <div style={{ flex: 1, width: 2, background: "linear-gradient(to bottom, #DCEAE2, transparent)", marginTop: 4, minHeight: 24 }} />}
      </div>

      {/* Card body */}
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          flex: 1, minWidth: 0, marginLeft: 12, marginBottom: 12,
          background: hov ? pal.surface : "#FFFFFF",
          border: `1.5px solid ${isPinned ? T.green : hov ? pal.border : T.border}`,
          borderRadius: 18, overflow: "hidden",
          transition: "all 0.22s cubic-bezier(0.16,1,0.3,1)",
          transform: hov ? "translateY(-2px)" : undefined,
          boxShadow: hov ? `0 12px 32px ${pal.accent}14` : "0 1px 4px rgba(15,23,42,0.05)",
        }}
      >
        {/* Pinned accent */}
        {isPinned && <div style={{ height: 3, background: `linear-gradient(90deg, ${T.green}, ${T.green}40)`, borderRadius: "18px 18px 0 0" }} />}

        {/* Row header (clickable) */}
        <div
          role="button" tabIndex={0}
          onClick={() => setExpanded(p => !p)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(p => !p); } }}
          style={{ padding: "14px 16px", cursor: "pointer", display: "grid", gridTemplateColumns: "1fr auto auto auto", alignItems: "center", gap: 10 }}
        >
          {/* Identity */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{capitalize(record.material)}</span>
              {isPinned && <span style={{ fontSize: 10, color: T.green }}>📌</span>}
              {record.category && <span style={{ fontSize: 11, color: T.muted }}>· {record.category}</span>}
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: conf.bg, color: conf.color, border: `1px solid ${conf.border}` }}>
                {capitalize(record.confidence_level)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: T.subtle }}>{formatDate(record.created_at)}</div>
          </div>

          {/* Value + weight */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.emerald, whiteSpace: "nowrap" }}>
              {record.final_price !== null ? `₹${record.final_price}` : "—"}
            </div>
            {record.weight !== null && <div style={{ fontSize: 11, color: T.subtle }}>{record.weight} kg</div>}
          </div>

          {/* Pin */}
          <button onClick={handlePinToggle} disabled={pinLoading} title={isPinned ? "Unpin" : "Pin"}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, opacity: pinLoading ? 0.5 : 1, color: isPinned ? T.green : T.subtle, padding: "2px 4px" }}>
            {isPinned ? "★" : "☆"}
          </button>

          {/* Expand chevron */}
          <span style={{ color: T.subtle, fontSize: 13, display: "inline-block", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.22s ease" }}>▾</span>
        </div>

        {/* Expanded panel */}
        {expanded && (
          <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginTop: 14, marginBottom: 12 }}>
              {[
                { label: "Condition",    value: capitalize(record.condition)        },
                { label: "Subtype",      value: capitalize(record.subtype)          },
                { label: "Cleanliness",  value: capitalize(record.cleanliness)      },
                { label: "Date",         value: formatDateShort(record.created_at)  },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "#F8FAFC", border: `1.5px solid ${T.border}`, borderRadius: 11, padding: "9px 12px" }}>
                  <div style={{ fontSize: 9.5, color: T.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{value}</div>
                </div>
              ))}
            </div>

            {record.summary && (
              <div style={{ background: "#F2FBF7", border: "1.5px solid rgba(16,185,129,0.2)", borderLeft: `3px solid ${T.green}`, borderRadius: "0 11px 11px 0", padding: "10px 14px", fontSize: 13, color: "#064E3B", lineHeight: 1.6, marginBottom: 12 }}>
                💡 {record.summary}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
              <button onClick={() => setModalOpen(true)}
                style={{ flex: 1, minWidth: 120, padding: "9px 16px", background: `linear-gradient(135deg, ${T.green}, ${T.emerald})`, color: "#fff", border: "none", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 14px rgba(16,185,129,0.28)" }}>
                🔍 View Full Analysis
              </button>
              <button onClick={e => { e.stopPropagation(); setShowConfirm(true); }}
                style={{ padding: "9px 16px", background: "#FFFFFF", border: `1.5px solid ${T.red}`, borderRadius: 11, cursor: "pointer", fontSize: 13, color: T.red, fontWeight: 600 }}>
                🗑 Delete
              </button>
            </div>

            {showConfirm && (
              <div style={{ marginTop: 10, padding: "14px 16px", background: "#FEF2F2", border: `1.5px solid rgba(220,38,38,0.3)`, borderRadius: 12 }}>
                <p style={{ fontSize: 13, color: T.text, marginBottom: 10, fontWeight: 500 }}>Permanently delete this analysis? This cannot be undone.</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleDelete} disabled={deleteLoading}
                    style={{ padding: "7px 18px", background: T.red, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: 700, opacity: deleteLoading ? 0.6 : 1 }}>
                    {deleteLoading ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button onClick={() => setShowConfirm(false)} disabled={deleteLoading}
                    style={{ padding: "7px 18px", background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 9, cursor: "pointer", fontSize: 12.5, color: T.muted }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <FeedbackWidget analysisId={record.id} />
          </div>
        )}
      </div>

      <AnalysisModal record={record} isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

// ─── Insights panel ───────────────────────────────────────────────────────────

function InsightsPanel({ records }: { records: AnalysisRecord[] }) {
  if (records.length === 0) return null;

  const byMaterial: Record<string, { count: number; totalValue: number }> = {};
  let highest = { price: 0, material: "—", date: "" };

  records.forEach(r => {
    const m = r.material || "unknown";
    if (!byMaterial[m]) byMaterial[m] = { count: 0, totalValue: 0 };
    byMaterial[m].count++;
    byMaterial[m].totalValue += r.final_price ?? 0;
    if ((r.final_price ?? 0) > highest.price) {
      highest = { price: r.final_price ?? 0, material: r.material ?? "—", date: formatDateShort(r.created_at) };
    }
  });

  const sortedByCount  = Object.entries(byMaterial).sort((a, b) => b[1].count - a[1].count);
  const sortedByValue  = Object.entries(byMaterial).sort((a, b) => b[1].totalValue - a[1].totalValue);
  const mostCommon     = sortedByCount[0];
  const mostProfitable = sortedByValue[0];

  const monthCounts: Record<string, number> = {};
  records.forEach(r => {
    const month = new Date(r.created_at).toLocaleString("en-IN", { month: "short", year: "2-digit" });
    monthCounts[month] = (monthCounts[month] ?? 0) + 1;
  });
  const bestMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];

  const insights = [
    { icon: "📦", label: "Most Common",     value: capitalize(mostCommon?.[0]),       sub: `${mostCommon?.[1].count} analyses`,    color: "#0284C7", surface: "#DBEAFE", border: "rgba(2,132,199,0.25)"   },
    { icon: "💰", label: "Most Profitable", value: capitalize(mostProfitable?.[0]),   sub: `₹${Math.round(mostProfitable?.[1].totalValue ?? 0)} total`, color: T.amber, surface: "#FEF3C7", border: "rgba(217,119,6,0.25)" },
    { icon: "📅", label: "Best Month",      value: bestMonth?.[0] ?? "—",            sub: `${bestMonth?.[1] ?? 0} analyses`,       color: T.violet, surface: "#EDE9FE", border: "rgba(139,92,246,0.25)"  },
    { icon: "🏆", label: "Highest Valuation", value: `₹${highest.price}`,            sub: `${capitalize(highest.material)} · ${highest.date}`, color: T.green, surface: "#D1FAE5", border: "rgba(16,185,129,0.25)" },
  ];

  return (
    <div style={{ background: "#F5F3FF", border: "1.5px solid #DDD6FE", borderRadius: 20, padding: "22px 24px" }}>
      <div style={{ marginBottom: 16 }}>
        <ZoneLabel icon="✨" text="Personal Intelligence Insights" color={T.violet} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        {insights.map(ins => (
          <div key={ins.label} style={{ background: "#FFFFFF", border: `1.5px solid ${ins.border}`, borderRadius: 14, padding: 16 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 22px ${ins.color}18`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: ins.surface, border: `1px solid ${ins.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, marginBottom: 10 }}>{ins.icon}</div>
            <div style={{ fontSize: 9.5, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{ins.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 3 }}>{ins.value}</div>
            <div style={{ fontSize: 11, color: ins.color, fontWeight: 600 }}>{ins.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Environmental Summary ────────────────────────────────────────────────────

function EnvironmentalSummary({ records, ready }: { records: AnalysisRecord[]; ready: boolean }) {
  if (records.length === 0) return null;
  const totalWeight = records.reduce((s, r) => s + (r.weight ?? 0), 0);
  const co2Saved    = Math.round(totalWeight * 2.5 * 10) / 10;
  const treesSaved  = Math.round(totalWeight * 0.0083 * 100) / 100;
  const sustainScore = Math.min(100, Math.round(20 + totalWeight * 1.8 + records.length * 3));

  const animWeight = useCountUp(Math.round(totalWeight), ready, 1100);
  const animCo2    = useCountUp(Math.round(co2Saved),    ready, 1100);

  if (totalWeight === 0) return null;

  return (
    <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 35%, #E0F4FF 70%, #FEF3C7 100%)", border: "1.5px solid #6EE7B7", borderRadius: 20, padding: "24px 26px" }}>
      <div style={{ position: "absolute", top: -70, right: -50, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 68%)", pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>
        <div style={{ marginBottom: 16 }}>
          <ZoneLabel icon="🌍" text="Recycling Impact Center" color={T.emerald} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 18 }}>
          {[
            { emoji: "⚖️", value: `${animWeight} kg`, label: "Scrap Recycled",  color: T.emerald },
            { emoji: "💨", value: `${animCo2} kg`,    label: "CO₂ Reduced",      color: T.sky2   },
            { emoji: "🌳", value: String(treesSaved), label: "Trees Saved",       color: "#059669" },
            { emoji: "🏅", value: String(sustainScore), label: "Sustain Score",  color: T.violet  },
          ].map(t => (
            <div key={t.label} style={{ background: "rgba(255,255,255,0.65)", border: "1.5px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: "16px 12px", textAlign: "center", backdropFilter: "blur(4px)" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{t.emoji}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: t.color, letterSpacing: "-0.03em", marginBottom: 4 }}>{t.value}</div>
              <div style={{ fontSize: 10.5, color: T.muted }}>{t.label}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(255,255,255,0.65)", border: "1.5px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: "14px 18px", backdropFilter: "blur(4px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#022C22" }}>Sustainability Score</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: T.emerald, background: "#D1FAE5", borderRadius: 999, padding: "2px 10px", border: "1px solid rgba(5,150,105,0.25)" }}>{sustainScore}/100</span>
          </div>
          <AnimBar value={sustainScore} color={T.emerald} height={7} />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const openId       = searchParams.get("open");

  const [user, setUser]         = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [records, setRecords]   = useState<AnalysisRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [filters, setFilters]   = useState<Record<string, string | null>>({ material: null, condition: null, cleanliness: null, confidence: null });
  const [sortBy, setSortBy]     = useState("newest");
  const [statsReady, setStatsReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setUser(session.user); setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login"); else setUser(session.user);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const load = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true); setError("");
    try {
      const res = await fetchHistory();
      setRecords(res.analyses ?? []);
      setStatsReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally { setLoading(false); }
  }, [user, authLoading]);

  useEffect(() => { load(); }, [load]);

  const handleDelete    = useCallback((id: string) => setRecords(p => p.filter(r => r.id !== id)), []);
  const handlePinToggle = useCallback((id: string, pinned: boolean) => setRecords(p => p.map(r => r.id === id ? { ...r, is_pinned: pinned } : r)), []);

  const stats           = useMemo(() => calculateStats(records), [records]);
  const filteredRecords = useMemo(() => applyFiltersAndSearch(records, search, filters), [records, search, filters]);
  const displayedRecords = useMemo(() => sortRecords(filteredRecords, sortBy), [filteredRecords, sortBy]);
  const availableValues = useMemo(() => ({
    material: extractUniqueValues(records, "material"), condition: extractUniqueValues(records, "condition"),
    cleanliness: extractUniqueValues(records, "cleanliness"), confidence: extractUniqueValues(records, "confidence_level"),
  }), [records]);

  const hasActiveFilters = search.trim() !== "" || Object.values(filters).some(v => v !== null);
  const handleExportCSV  = () => exportToCSV(displayedRecords,  timestampedFilename("csv"));
  const handleExportJSON = () => exportToJSON(displayedRecords, timestampedFilename("json"));

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F2FBF7" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: "dFloat 2s ease-in-out infinite" }}>📜</div>
          <span style={{ color: T.muted, fontSize: 14 }}>Loading your archive…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#F0F7F3", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: T.text }}>
      <main style={{ maxWidth: 1320, margin: "0 auto", padding: "28px clamp(12px, 4vw, 24px) 80px" }}>

        {/* ── PAGE HERO ── */}
        <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(140deg, #EDFAF4 0%, #D4F1E4 35%, #E8F4FF 70%, #EEE8FF 100%)", border: "1.5px solid #B8E6D0", borderRadius: 24, padding: "32px 28px", marginBottom: 16, animation: "dReveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
          <div style={{ position: "absolute", top: -80, right: -60, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 65%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -70, left: "15%", width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ marginBottom: 18 }}>
              <ZoneLabel icon="📜" text="Personal Scrap Intelligence Archive" color={T.emerald} live />
            </div>
            <h1 style={{ fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 900, letterSpacing: "-0.04em", color: "#0A2218", lineHeight: 1.15, marginBottom: 8 }}>
              Your AI Intelligence Journey 🧠
            </h1>
            <p style={{ fontSize: 14.5, color: "#374151", lineHeight: 1.65, maxWidth: 460, marginBottom: 0 }}>
              Every analysis you've run, ranked, filtered, and explored — with AI-powered insights on each record.
            </p>
          </div>
        </div>

        {/* ── LOADING ── */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 72, background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 18, animation: "dShimmer 1.5s infinite", backgroundImage: "linear-gradient(90deg, #F1F5F9 25%, #E8F0EC 50%, #F1F5F9 75%)", backgroundSize: "200% 100%", opacity: 1 - i * 0.2 }} />
            ))}
            <p style={{ color: T.muted, fontSize: 13, textAlign: "center" }}>Fetching your analyses…</p>
          </div>
        )}

        {/* ── ERROR ── */}
        {!loading && error && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid rgba(220,38,38,0.3)", borderRadius: 18, padding: 24, textAlign: "center", marginBottom: 16 }}>
            <p style={{ color: T.red, fontWeight: 700, marginBottom: 6 }}>⚠️ Failed to load history</p>
            <p style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>{error}</p>
            <button onClick={load} style={{ padding: "9px 24px", background: `linear-gradient(135deg, ${T.green}, ${T.emerald})`, color: "#fff", border: "none", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Retry</button>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && !error && records.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 16px", background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 20 }}>
            <div style={{ fontSize: 44, marginBottom: 14, animation: "dFloat 3s ease-in-out infinite" }}>📭</div>
            <h2 style={{ color: T.text, fontWeight: 700, marginBottom: 6 }}>No analyses yet</h2>
            <p style={{ color: T.muted, fontSize: 13.5, marginBottom: 24 }}>Complete your first valuation to see it here. It only takes a photo!</p>
            <Link href="/upload" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 28px", background: `linear-gradient(135deg, ${T.green}, ${T.emerald})`, color: "#fff", borderRadius: 14, textDecoration: "none", fontSize: 14, fontWeight: 700, boxShadow: "0 6px 20px rgba(16,185,129,0.3)" }}>
              Analyse an Item →
            </Link>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        {!loading && !error && records.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Hero Stats */}
            <div style={{ opacity: 0, animation: "dReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>
              <HeroStats stats={stats} ready={statsReady} />
            </div>

            {/* Toolbar */}
            <div style={{ opacity: 0, animation: "dReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.18s both" }}>
              <SearchToolbar
                search={search} setSearch={setSearch}
                filters={filters} onFilterChange={(f, v) => setFilters(p => ({ ...p, [f]: v }))}
                sortBy={sortBy} setSortBy={setSortBy}
                availableValues={availableValues}
                hasActiveFilters={hasActiveFilters} onClearAll={() => { setSearch(""); setFilters({ material: null, condition: null, cleanliness: null, confidence: null }); setSortBy("newest"); }}
                totalCount={records.length} filteredCount={displayedRecords.length}
                onExportCSV={handleExportCSV} onExportJSON={handleExportJSON}
              />
            </div>

            {/* Insights */}
            <div style={{ opacity: 0, animation: "dReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.24s both" }}>
              <InsightsPanel records={records} />
            </div>

            {/* Timeline */}
            <div style={{ opacity: 0, animation: "dReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.3s both" }}>
              {displayedRecords.length === 0 && hasActiveFilters ? (
                <div style={{ textAlign: "center", padding: "52px 16px", background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 20 }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                  <h2 style={{ color: T.text, fontWeight: 700, marginBottom: 6 }}>No matching analyses</h2>
                  <p style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Try adjusting your search or filters.</p>
                  <button onClick={() => { setSearch(""); setFilters({ material: null, condition: null, cleanliness: null, confidence: null }); setSortBy("newest"); }}
                    style={{ padding: "9px 24px", background: `linear-gradient(135deg, ${T.green}, ${T.emerald})`, color: "#fff", border: "none", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                    Clear all filters
                  </button>
                </div>
              ) : (
                <div style={{ paddingLeft: 0 }}>
                  {displayedRecords.map((r, i) => (
                    <TimelineCard
                      key={r.id} record={r}
                      defaultExpanded={r.id === openId}
                      onDelete={handleDelete} onPinToggle={handlePinToggle}
                      isLast={i === displayedRecords.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Environmental impact */}
            <div style={{ opacity: 0, animation: "dReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.36s both" }}>
              <EnvironmentalSummary records={records} ready={statsReady} />
            </div>

          </div>
        )}
      </main>

      <style>{`
        @keyframes dReveal { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes dRipple { 0%{transform:scale(0.7);opacity:0.5} 100%{transform:scale(2.4);opacity:0} }
        @keyframes dShimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        input::placeholder { color: #94A3B8; }
        select option { background:#fff; color:#0F172A; }
      `}</style>
    </div>
  );
}