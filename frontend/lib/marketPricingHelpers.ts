/**
 * Market Pricing Helpers
 * ======================
 * Utilities for formatting, filtering, and processing market data for UI display.
 */

import {
  EnrichedMaterial,
  MATERIAL_CONFIG,
  STATUS_BADGES,
  DISPLAY_THRESHOLDS,
  TIER_1_MATERIALS,
  TIER_2_MATERIALS,
  createFallbackMaterial,
} from "./marketConfig";

// ─── Formatting Helpers ──────────────────────────────────────────────────────

/**
 * Format price as currency string
 * Defensively handles undefined/null price values
 */
export function formatPrice(price: number | undefined | null): string {
  const safePrice: number = !Number.isFinite(price) ? 0 : (price as number);
  return `$${safePrice.toFixed(2)}/lb`;
}

/**
 * Format price change with sign and color
 * Defensively handles undefined/null changePercent values
 */
export function formatChange(
  changePercent: number | undefined | null
): { text: string; color: string } {
  const safePercent = typeof changePercent === "number" && Number.isFinite(changePercent) ? changePercent : 0;
  const sign = safePercent > 0 ? "+" : "";
  return {
    text: `${sign}${safePercent.toFixed(2)}%`,
    color: safePercent > 0 ? "#4ade80" : safePercent < 0 ? "#f87171" : "#60a5fa",
  };
}

/**
 * Get status badge for trend
 */
export function getStatusBadge(
  status: "rising" | "falling" | "stable"
): { label: string; color: string; emoji: string } {
  return STATUS_BADGES[status] || STATUS_BADGES.stable;
}

/**
 * Get freshness indicator
 */
export function getFreshnessIndicator(data: EnrichedMaterial): {
  text: string;
  isFresh: boolean;
  isStale: boolean;
} {
  const minutesAgo = data.minutesAgo || "unknown";
  const isStale = data.isStale;

  return {
    text: isStale ? `${minutesAgo} (stale)` : minutesAgo,
    isFresh: !isStale && data.minutesAgo !== "fallback",
    isStale: isStale,
  };
}

// ─── Search & Filter Helpers ────────────────────────────────────────────────

/**
 * Search materials by name or category
 */
export function searchMaterials(
  query: string,
  materials: Record<string, EnrichedMaterial>
): Record<string, EnrichedMaterial> {
  if (!query.trim()) return materials;

  const lowerQuery = query.toLowerCase();

  return Object.entries(materials).reduce((acc, [id, data]) => {
    const config = MATERIAL_CONFIG[id];
    if (!config) return acc;

    const matches =
      config.name.toLowerCase().includes(lowerQuery) ||
      config.description.toLowerCase().includes(lowerQuery) ||
      config.category.toLowerCase().includes(lowerQuery) ||
      id.toLowerCase().includes(lowerQuery);

    if (matches) {
      acc[id] = data;
    }

    return acc;
  }, {} as Record<string, EnrichedMaterial>);
}

/**
 * Filter materials by category
 */
export function filterByCategory(
  category: string,
  materials: Record<string, EnrichedMaterial>
): Record<string, EnrichedMaterial> {
  if (!category) return materials;

  return Object.entries(materials).reduce((acc, [id, data]) => {
    const config = MATERIAL_CONFIG[id];
    if (config && config.category === category) {
      acc[id] = data;
    }
    return acc;
  }, {} as Record<string, EnrichedMaterial>);
}

/**
 * Sort materials by price change
 * Defensively handles undefined/null changePercent values
 */
export function sortByChange(
  materials: Record<string, EnrichedMaterial>,
  direction: "asc" | "desc" = "desc"
): Array<[string, EnrichedMaterial]> {
  return Object.entries(materials).sort(([, a], [, b]) => {
    const aChange = Number.isFinite(a.changePercent) ? a.changePercent : 0;
    const bChange = Number.isFinite(b.changePercent) ? b.changePercent : 0;
    const comparison = bChange - aChange;
    return direction === "desc" ? comparison : -comparison;
  });
}

/**
 * Sort materials by price
 * Defensively handles undefined/null price values
 */
export function sortByPrice(
  materials: Record<string, EnrichedMaterial>,
  direction: "asc" | "desc" = "desc"
): Array<[string, EnrichedMaterial]> {
  return Object.entries(materials).sort(([, a], [, b]) => {
    const aPrice = Number.isFinite(a.price) ? a.price : 0;
    const bPrice = Number.isFinite(b.price) ? b.price : 0;
    const comparison = bPrice - aPrice;
    return direction === "desc" ? comparison : -comparison;
  });
}

// ─── Insight Generation ──────────────────────────────────────────────────────

/**
 * Generate comprehensive market insights from all materials
 * Defensively handles undefined/null changePercent values
 */
export function generateMarketInsights(
  materials: Record<string, EnrichedMaterial>
): string[] {
  const insights: string[] = [];

  // Find extreme movements
  const entries = Object.entries(materials);
  if (entries.length === 0) return insights;

  // Safe getter for changePercent with fallback to 0
  const getChangePercent = (data: EnrichedMaterial): number =>
    Number.isFinite(data.changePercent) ? data.changePercent : 0;

  // Biggest gainer
  const maxGainer = entries.reduce(
    (max, [, data]) =>
      getChangePercent(data) > getChangePercent(max) ? data : max,
    entries[0]?.[1] || { changePercent: 0 }
  );

  if (getChangePercent(maxGainer) > DISPLAY_THRESHOLDS.highGain) {
    insights.push(maxGainer.insight || "Market moving");
  }

  // Biggest loser
  const maxLoser = entries.reduce(
    (min, [, data]) =>
      getChangePercent(data) < getChangePercent(min) ? data : min,
    entries[0]?.[1] || { changePercent: 0 }
  );

  if (getChangePercent(maxLoser) < DISPLAY_THRESHOLDS.highLoss) {
    insights.push(maxLoser.insight || "Market declining");
  }

  // Market breadth
  const risers = entries.filter(([, data]) => getChangePercent(data) > 0).length;
  const fallers = entries.filter(([, data]) => getChangePercent(data) < 0).length;
  const total = entries.length;

  if (risers > total / 2) {
    insights.push("📈 Market broadly higher");
  } else if (fallers > total / 2) {
    insights.push("📉 Market broadly lower");
  } else {
    insights.push("➡️ Mixed market signals");
  }

  // Average volatility
  const avgAbsChange =
    entries.reduce((sum, [, data]) => sum + Math.abs(getChangePercent(data)), 0) /
    entries.length;

  if (avgAbsChange > DISPLAY_THRESHOLDS.volatilityHigh) {
    insights.push("⚡ Elevated volatility");
  }

  return [...new Set(insights)]; // Remove duplicates
}

/**
 * Get source credibility indicator
 */
export function getSourceCredibility(
  source: string,
  isCached: boolean,
  isStale: boolean
): { level: "live" | "cached" | "stale" | "fallback"; icon: string } {
  if (source === "fallback") {
    return { level: "fallback", icon: "⚠️" };
  }
  if (isStale) {
    return { level: "stale", icon: "🕐" };
  }
  if (isCached) {
    return { level: "cached", icon: "💾" };
  }
  return { level: "live", icon: "🔴" };
}

// ─── Sparkline Helpers ───────────────────────────────────────────────────────

/**
 * Normalize sparkline data to 0-100 range
 * Handles edge cases: empty arrays, undefined values, NaN
 */
export function normalizeSparklineData(
  points: number[]
): { normalized: number[]; min: number; max: number } {
  // Defensive: filter out invalid values
  const validPoints = (points || [])
    .filter((p) => Number.isFinite(p))
    .map(Number);
  
  if (validPoints.length === 0) {
    // Return default flat line at 50% if no valid data
    return { normalized: [50, 50], min: 0, max: 100 };
  }

  const min = Math.min(...validPoints);
  const max = Math.max(...validPoints);
  const range = max - min || 1;

  return {
    normalized: validPoints.map((p) => ((p - min) / range) * 100),
    min,
    max,
  };
}

/**
 * Create SVG polyline points string for sparkline
 * Returns coordinate pairs for <polyline> element (not path syntax)
 * Format: "0,40 20,30 40,20" (NOT "M 0,40 L 20,30")
 */
export function createSparklinePath(
  points: number[],
  width: number = 100,
  height: number = 40
): string {
  // Defensive: handle undefined, empty, or invalid arrays
  const validPoints = (points || [])
    .filter((p) => Number.isFinite(p))
    .map(Number);
  
  if (validPoints.length < 1) {
    // Return a flat line at 50% if no valid data
    return `0,${height / 2} ${width},${height / 2}`;
  }

  const normalized = normalizeSparklineData(validPoints);
  const xStep = validPoints.length > 1 ? width / (validPoints.length - 1) : width;

  // Generate polyline coordinate pairs: "x1,y1 x2,y2 x3,y3"
  const polylinePoints = normalized.normalized
    .map((y, i) => `${i * xStep},${height - (y / 100) * height}`)
    .join(" ");

  return polylinePoints;
}

/**
 * Determine sparkline color based on trend
 */
export function getSparklineColor(status: "rising" | "falling" | "stable"): string {
  const badge = STATUS_BADGES[status];
  return badge.color;
}

// ─── Aggregation Helpers ────────────────────────────────────────────────────

/**
 * Calculate market summary statistics
 */
export function getMarketSummary(materials: Record<string, EnrichedMaterial>) {
  const entries = Object.entries(materials);

  if (entries.length === 0) {
    return {
      totalValue: 0,
      avgChange: 0,
      risers: 0,
      fallers: 0,
      stable: 0,
      topMover: null,
    };
  }

  const risers = entries.filter(([, d]) => d.changePercent > 0).length;
  const fallers = entries.filter(([, d]) => d.changePercent < 0).length;
  const stable = entries.filter(([, d]) => d.changePercent === 0).length;

  const totalValue = entries.reduce((sum, [, d]) => sum + d.price, 0);
  const avgChange =
    entries.reduce((sum, [, d]) => sum + d.changePercent, 0) / entries.length;

  // Top mover
  const topMover = entries.reduce((top, [id, d]) =>
    Math.abs(d.changePercent) > Math.abs(top[1].changePercent) ? [id, d] : top
  );

  return {
    totalValue,
    avgChange,
    risers,
    fallers,
    stable,
    topMover: topMover ? topMover[0] : null,
  };
}

/**
 * Group materials by category
 */
export function groupByCategory(
  materials: Record<string, EnrichedMaterial>
): Record<string, Array<[string, EnrichedMaterial]>> {
  return Object.entries(materials).reduce(
    (acc, [id, data]) => {
      const config = MATERIAL_CONFIG[id];
      const category = config?.category || "other";

      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push([id, data]);

      return acc;
    },
    {} as Record<string, Array<[string, EnrichedMaterial]>>
  );
}

// ─── Data Enrichment ─────────────────────────────────────────────────────────

/**
 * Enrich market data with fallback materials
 * 
 * Ensures all 6 materials are always present:
 * - Tier 1 (Live): copper, aluminum, steel — use real API data
 * - Tier 2 (Fallback): iron, brass, plastic — use safe estimated data
 * 
 * This guarantees consistent UI rendering and prevents material visibility gaps.
 */
export function enrichMarketDataWithFallbacks(
  apiData: Record<string, EnrichedMaterial>
): Record<string, EnrichedMaterial> {
  const enriched: Record<string, EnrichedMaterial> = { ...apiData };

  // Ensure all Tier 2 materials exist with fallback data
  for (const materialId of TIER_2_MATERIALS) {
    if (!enriched[materialId]) {
      enriched[materialId] = createFallbackMaterial(materialId);
    }
  }

  return enriched;
}
