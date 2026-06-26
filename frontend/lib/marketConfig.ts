/**
 * Market Pricing Configuration
 * ============================
 * Central constants and configuration for market pricing UI.
 */

export interface MaterialConfig {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  tier?: "live" | "fallback"; // Data source tier
  fallbackPrice?: number; // Safe fallback price per lb
}

export interface PriceDataPoint {
  price: number;
  change: number;
  changePercent: number;
  source: string;
  timestamp: number;
  unit: string;
  isCached: boolean;
  isStale: boolean;
  minutesAgo?: string;
}

export interface EnrichedMaterial extends PriceDataPoint {
  trend: number[]; // Historical price points for sparkline
  insight: string; // Market insight text
  status: "rising" | "falling" | "stable"; // Trend direction
}

// ─── Material Definitions ────────────────────────────────────────────────────

export const MATERIAL_CONFIG: Record<string, MaterialConfig> = {
  copper: {
    id: "copper",
    name: "Copper",
    icon: "🟤",
    category: "precious-metals",
    description: "High-value conductive metal",
    tier: "live",
    fallbackPrice: 4.20,
  },
  aluminum: {
    id: "aluminum",
    name: "Aluminum",
    icon: "⚪",
    category: "light-metals",
    description: "Lightweight, highly recyclable",
    tier: "live",
    fallbackPrice: 1.05,
  },
  steel: {
    id: "steel",
    name: "Steel",
    icon: "🔩",
    category: "ferrous",
    description: "Iron alloy, most abundant",
    tier: "live",
    fallbackPrice: 0.22,
  },
  iron: {
    id: "iron",
    name: "Iron",
    icon: "🔨",
    category: "ferrous",
    description: "Ferrous metal, structural",
    tier: "fallback",
    fallbackPrice: 0.12,
  },
  brass: {
    id: "brass",
    name: "Brass",
    icon: "🟢",
    category: "precious-metals",
    description: "Copper-zinc alloy",
    tier: "fallback",
    fallbackPrice: 1.85,
  },
  plastic: {
    id: "plastic",
    name: "Plastic",
    icon: "♻️",
    category: "recyclables",
    description: "Polyethylene, polypropylene",
    tier: "fallback",
    fallbackPrice: 0.08,
  },
};

export const MATERIAL_CATEGORIES = [
  {
    id: "precious-metals",
    label: "Precious Metals",
    description: "High-value conductive materials",
  },
  {
    id: "light-metals",
    label: "Light Metals",
    description: "Aluminum and derivatives",
  },
  {
    id: "ferrous",
    label: "Ferrous",
    description: "Iron and steel alloys",
  },
  {
    id: "recyclables",
    label: "Recyclables",
    description: "Plastics and polymers",
  },
];

// ─── API Configuration ───────────────────────────────────────────────────────

export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  endpoints: {
    marketPrices: "/api/market/prices",
    marketInsights: "/api/market/insights",
  },
  timeouts: {
    default: 10000,
    market: 12000,
  },
};

// ─── Cache & Refresh Settings ────────────────────────────────────────────────

export const CACHE_CONFIG = {
  ttlMs: 5 * 60 * 1000, // 5 minutes
  staleThresholdMs: 15 * 60 * 1000, // 15 minutes
  refreshIntervalMs: 4 * 60 * 1000, // Refresh every 4 minutes (before stale)
};

// ─── Display Thresholds ──────────────────────────────────────────────────────

export const DISPLAY_THRESHOLDS = {
  highGain: 5, // % increase
  highLoss: -5, // % decrease
  volatilityHigh: 3,
};

// ─── Status Badges ──────────────────────────────────────────────────────────

export const STATUS_BADGES = {
  rising: {
    label: "↑ Rising",
    color: "#4ade80", // Green
    emoji: "📈",
  },
  falling: {
    label: "↓ Falling",
    color: "#f87171", // Red
    emoji: "📉",
  },
  stable: {
    label: "→ Stable",
    color: "#60a5fa", // Blue
    emoji: "➡️",
  },
};

// ─── Insight Keywords ────────────────────────────────────────────────────────

export const INSIGHT_KEYWORDS = {
  surging: ["surge", "strong demand", "up"],
  gaining: ["gaining", "momentum", "growth"],
  declining: ["decline", "pressure", "down"],
  softening: ["soften", "caution"],
  stable: ["stable", "steady"],
};

// ─── Material Tiers ──────────────────────────────────────────────────────────
// Tier 1: Live materials (request real market data from API)
export const TIER_1_MATERIALS = new Set(["copper", "aluminum", "steel"]);

// Tier 2: Fallback materials (use safe estimated prices when not in API response)
export const TIER_2_MATERIALS = new Set(["iron", "brass", "plastic"]);

// ─── Fallback Trend Generator ────────────────────────────────────────────────
/**
 * Generate a stable fallback trend array for Tier 2 materials
 * Creates a realistic gentle trend (slightly rising) without jitter
 */
export function generateFallbackTrend(
  materialId: string,
  length = 7
): number[] {
  // Use material ID as seed for deterministic but unique trends
  const hash = materialId
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const baseVariation = (hash % 100) / 1000; // 0 to 0.1

  const trend: number[] = [];
  let value = 100;

  for (let i = 0; i < length; i++) {
    // Gentle upward trend with minimal variation
    value += baseVariation + (Math.random() - 0.45) * 0.5;
    value = Math.max(90, Math.min(110, value)); // Keep between 90-110
    trend.push(Math.round(value * 10) / 10);
  }

  return trend;
}

// ─── Fallback Material Creator ────────────────────────────────────────────────
/**
 * Create a safe fallback EnrichedMaterial for Tier 2 materials
 * Used when the material is not returned by the API
 */
export function createFallbackMaterial(
  materialId: string
): EnrichedMaterial {
  const config = MATERIAL_CONFIG[materialId];
  if (!config || !config.fallbackPrice) {
    throw new Error(`No fallback configuration for material: ${materialId}`);
  }

  const trend = generateFallbackTrend(materialId, 7);

  return {
    price: config.fallbackPrice,
    change: 0,
    changePercent: 2.5, // Slight estimated increase
    source: "fallback",
    timestamp: Date.now(),
    unit: "USD/lb",
    isCached: false,
    isStale: false,
    minutesAgo: "estimated",
    trend,
    insight: `${config.name} — estimated market rate based on recent trends`,
    status: "stable",
  };
}
