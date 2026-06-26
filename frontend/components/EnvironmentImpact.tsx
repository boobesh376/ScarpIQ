"use client";

import { calculateEnvironmentalImpact } from "@/lib/dashboardHelpers";
import { type AnalysisRecord } from "@/lib/api";
import { useMemo } from "react";

interface EnvironmentImpactProps {
  analyses: AnalysisRecord[];
}

export function EnvironmentImpact({ analyses }: EnvironmentImpactProps) {
  const impact = useMemo(() => calculateEnvironmentalImpact(analyses || []), [analyses]);
  const hasImpact = impact.totalWeight > 0;

  const cardStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, rgba(0,200,150,0.04), rgba(94,234,212,0.04))",
    border: "1px solid rgba(0,200,150,0.18)",
    borderRadius: "20px",
    padding: "24px",
  };

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
      <div style={{
        width: "34px", height: "34px", borderRadius: "10px",
        background: "rgba(0,200,150,0.12)", border: "1px solid rgba(0,200,150,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
      }}>🌍</div>
      <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>Environmental Impact</h3>
    </div>
  );

  if (!analyses || analyses.length === 0) {
    return (
      <div style={cardStyle}>
        {header}
        <div style={{ textAlign: "center", padding: "20px 12px" }}>
          <div style={{ fontSize: "30px", marginBottom: "10px" }}>♻️</div>
          <p style={{ color: "#475569", fontSize: "13.5px" }}>
            Start analyzing items to track your environmental contribution
          </p>
        </div>
      </div>
    );
  }

  if (!hasImpact) {
    return (
      <div style={cardStyle}>
        {header}
        <div style={{ textAlign: "center", padding: "16px 12px" }}>
          <p style={{ color: "#475569", fontSize: "13.5px" }}>
            Weight data will be available when you analyze items with weight info
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {header}

      <div style={{ maxWidth: "640px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <ImpactTile emoji="⚖️" value={`${impact.totalWeight}kg`} label="Recycled" />
          <ImpactTile emoji="💨" value={`${impact.co2Saved}kg`} label="CO₂ Saved" />
          <ImpactTile emoji="🌳" value={String(impact.treesEquivalent)} label="Trees Saved" />
        </div>

        <div style={{ fontSize: "12.5px", color: "#475569", lineHeight: 1.6 }}>
          ✨ Your recycling efforts are equivalent to planting{" "}
          <strong style={{ color: "#00B383" }}>{impact.treesEquivalent} trees</strong>!
        </div>
      </div>
    </div>
  );
}

function ImpactTile({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div style={{
      padding: "14px 8px",
      background: "rgba(255,255,255,0.6)",
      border: "1px solid rgba(0,200,150,0.15)",
      borderRadius: "12px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: "20px", marginBottom: "6px" }}>{emoji}</div>
      <div style={{ fontSize: "16px", fontWeight: 800, color: "#00B383", marginBottom: "2px" }}>{value}</div>
      <div style={{ fontSize: "10.5px", color: "#64748B" }}>{label}</div>
    </div>
  );
}
