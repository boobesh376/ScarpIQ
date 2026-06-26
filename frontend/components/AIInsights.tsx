"use client";

import { generateInsights } from "@/lib/dashboardHelpers";
import { type AnalysisRecord } from "@/lib/api";
import { useMemo } from "react";

interface AIInsightsProps {
  analyses: AnalysisRecord[];
}

export function AIInsights({ analyses }: AIInsightsProps) {
  const insights = useMemo(() => generateInsights(analyses || []), [analyses]);

  const cardStyle: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "20px",
    padding: "24px",
    boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
  };

  if (!analyses || analyses.length === 0) {
    return (
      <div style={cardStyle}>
        <SectionHeader />
        <div style={{ textAlign: "center", padding: "28px 12px" }}>
          <div style={{ fontSize: "30px", marginBottom: "10px" }}>📈</div>
          <p style={{ color: "#94A3B8", fontSize: "13.5px" }}>Start analyzing items to see insights</p>
        </div>
      </div>
    );
  }

  const trendColor =
    insights.trendDirection === "positive"
      ? "#00B383"
      : insights.trendDirection === "negative"
        ? "#DC2626"
        : "#94A3B8";

  const trendBg =
    insights.trendDirection === "positive"
      ? "rgba(0,200,150,0.08)"
      : insights.trendDirection === "negative"
        ? "rgba(220,38,38,0.06)"
        : "rgba(148,163,184,0.1)";

  return (
    <div style={cardStyle}>
      <SectionHeader />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
        <InsightTile label="Total Analyses" value={insights.totalAnalyses} accent="#7C3AED" />
        <InsightTile label="Avg Valuation" value={`₹${Math.round(insights.averageValue)}`} accent="#00B383" />
        <InsightTile label="Total Value" value={`₹${Math.round(insights.totalValue)}`} accent="#0EA5E9" />
        <InsightTile
          label="Highest Value"
          value={insights.highestValue ? `₹${Math.round(insights.highestValue)}` : "—"}
          accent="#FFB800"
        />
      </div>

      {insights.mostAnalyzedMaterial && (
        <div style={{ fontSize: "13px", color: "#475569", marginBottom: "10px", lineHeight: 1.6 }}>
          <strong style={{ color: "#00B383" }}>{insights.mostAnalyzedMaterial.material}</strong>{" "}
          is your most analyzed material ({insights.mostAnalyzedMaterial.count} times)
        </div>
      )}

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 12px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: 700,
          background: trendBg,
          border: `1px solid ${trendColor}33`,
          color: trendColor,
        }}
      >
        {insights.trendDirection === "positive"
          ? "📈 Trend: Positive"
          : insights.trendDirection === "negative"
            ? "📉 Trend: Negative"
            : "→ Trend: Neutral"}
      </div>
    </div>
  );
}

function SectionHeader() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
      <div style={{
        width: "34px", height: "34px", borderRadius: "10px",
        background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
      }}>🧠</div>
      <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>AI Insights</h3>
    </div>
  );
}

function InsightTile({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div style={{
      padding: "12px 14px",
      background: `${accent}0d`,
      border: `1px solid ${accent}28`,
      borderRadius: "12px",
    }}>
      <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "4px", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "19px", fontWeight: 800, color: accent }}>{value}</div>
    </div>
  );
}
