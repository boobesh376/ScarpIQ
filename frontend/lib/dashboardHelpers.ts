import type { AnalysisRecord } from "./api";

/**
 * Market price data (mock - can be replaced with real API)
 */
export interface MarketPrice {
  material: string;
  price: number;
  unit: string;
  trend: "up" | "down" | "stable";
  change: number; // percentage
  emoji: string;
}

export const MOCK_MARKET_PRICES: MarketPrice[] = [
  {
    material: "Copper",
    price: 720,
    unit: "₹/kg",
    trend: "up",
    change: 2.5,
    emoji: "🟤",
  },
  {
    material: "Aluminum",
    price: 185,
    unit: "₹/kg",
    trend: "down",
    change: -1.2,
    emoji: "⚪",
  },
  {
    material: "Iron",
    price: 35,
    unit: "₹/kg",
    trend: "stable",
    change: 0,
    emoji: "⚙️",
  },
  {
    material: "Plastic",
    price: 25,
    unit: "₹/kg",
    trend: "up",
    change: 0.8,
    emoji: "♻️",
  },
];

/**
 * Get trend indicator symbol
 */
export function getTrendIcon(trend: "up" | "down" | "stable"): string {
  switch (trend) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "stable":
      return "→";
  }
}

/**
 * Get trend color
 */
export function getTrendColor(trend: "up" | "down" | "stable"): string {
  switch (trend) {
    case "up":
      return "#22c55e"; // green
    case "down":
      return "#ef4444"; // red
    case "stable":
      return "#94a3b8"; // gray
  }
}

/**
 * Analyze user history and generate insights
 */
export interface DashboardInsights {
  totalAnalyses: number;
  mostAnalyzedMaterial: { material: string; count: number } | null;
  highestValue: number | null;
  averageValue: number;
  totalValue: number;
  trendDirection: "positive" | "negative" | "neutral";
}

export function generateInsights(analyses: AnalysisRecord[]): DashboardInsights {
  if (!analyses || analyses.length === 0) {
    return {
      totalAnalyses: 0,
      mostAnalyzedMaterial: null,
      highestValue: null,
      averageValue: 0,
      totalValue: 0,
      trendDirection: "neutral",
    };
  }

  // Count materials
  const materialCounts: Record<string, number> = {};
  let mostAnalyzedMaterial: { material: string; count: number } | null = null;

  analyses.forEach((a) => {
    const material = a.material || a.category || "Unknown";
    materialCounts[material] = (materialCounts[material] || 0) + 1;

    if (!mostAnalyzedMaterial || materialCounts[material] > mostAnalyzedMaterial.count) {
      mostAnalyzedMaterial = { material, count: materialCounts[material] };
    }
  });

  // Calculate price statistics
  const validPrices = analyses
    .filter((a) => a.final_price && !isNaN(a.final_price))
    .map((a) => a.final_price as number);

  const totalValue = validPrices.reduce((sum, price) => sum + price, 0);
  const averageValue = validPrices.length > 0 ? totalValue / validPrices.length : 0;
  const highestValue = validPrices.length > 0 ? Math.max(...validPrices) : null;

  // Determine trend (simple: compare first half vs second half)
  let trendDirection: "positive" | "negative" | "neutral" = "neutral";
  if (validPrices.length >= 2) {
    const mid = Math.floor(validPrices.length / 2);
    const firstHalf = validPrices.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondHalf = validPrices.slice(mid).reduce((a, b) => a + b, 0) / (validPrices.length - mid);
    if (secondHalf > firstHalf * 1.05) {
      trendDirection = "positive";
    } else if (secondHalf < firstHalf * 0.95) {
      trendDirection = "negative";
    }
  }

  return {
    totalAnalyses: analyses.length,
    mostAnalyzedMaterial,
    highestValue,
    averageValue,
    totalValue,
    trendDirection,
  };
}

/**
 * Calculate environmental impact
 */
export interface EnvironmentalImpact {
  totalWeight: number;
  co2Saved: number;
  treesEquivalent: number;
}

export function calculateEnvironmentalImpact(
  analyses: AnalysisRecord[]
): EnvironmentalImpact {
  // Calculate total weight
  const totalWeight = analyses
    .filter((a) => a.weight && !isNaN(a.weight))
    .reduce((sum, a) => sum + (a.weight || 0), 0);

  // CO2 saved: roughly 2kg CO2 per kg of metal recycled, 0.5kg for plastic
  let co2Saved = 0;
  analyses.forEach((a) => {
    if (a.weight) {
      const material = (a.material || "").toLowerCase();
      const factor = material.includes("plastic") ? 0.5 : 2; // kg CO2 per kg scrap
      co2Saved += a.weight * factor;
    }
  });

  // Trees equivalent: 1 tree absorbs ~16kg CO2 in a year
  const treesEquivalent = Math.round(co2Saved / 16);

  return {
    totalWeight: Math.round(totalWeight * 10) / 10,
    co2Saved: Math.round(co2Saved * 10) / 10,
    treesEquivalent,
  };
}

/**
 * Format date for profile
 */
export function formatJoinedDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return "Recently";
  }
}

/**
 * Get user initials
 */
export function getUserInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.charAt(0)?.toUpperCase() || "U";
  const l = lastName?.charAt(0)?.toUpperCase() || "";
  return (f + l).substring(0, 2);
}
