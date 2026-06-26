"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Landing.module.css";

const FEATURES = [
  {
    id: "ai-recognition",
    icon: "🤖",
    title: "AI Material Recognition",
    desc: "Computer vision trained on 2M+ scrap images. Identifies metal type, alloy grade, and condition with sub-second precision.",
    color: "#10B981",
    size: "large",
    badge: "Core Feature",
    stat: "47 material types",
  },
  {
    id: "smart-valuation",
    icon: "💡",
    title: "Smart Valuation",
    desc: "Dynamic pricing engine synced to live scrap market feeds. Get accurate per-kg rates before you negotiate.",
    color: "#7C3AED",
    size: "medium",
    badge: "Real-Time",
    stat: "97% accuracy",
  },
  {
    id: "market-intelligence",
    icon: "📈",
    title: "Market Intelligence",
    desc: "Track price trends, demand cycles, and regional price variations across India's major scrap markets.",
    color: "#FFB800",
    size: "medium",
    badge: "Live Data",
    stat: "Updated hourly",
  },
  {
    id: "sustainability",
    icon: "🌿",
    title: "Sustainability Tracking",
    desc: "Every analysis includes your environmental impact — CO₂ saved, energy conserved, circular economy contribution.",
    color: "#10B981",
    size: "small",
    badge: "ESG Ready",
    stat: "CO₂ per kg",
  },
  {
    id: "history",
    icon: "📜",
    title: "Historical Insights",
    desc: "Full analysis history with price trend overlays. Spot patterns and optimise your timing.",
    color: "#0EA5E9",
    size: "small",
    badge: "Analytics",
    stat: "Unlimited storage",
  },
  {
    id: "community",
    icon: "👥",
    title: "Community Knowledge",
    desc: "Learn from thousands of dealers. Compare prices, share tips, and access community intelligence.",
    color: "#EC4899",
    size: "small",
    badge: "Network",
    stat: "5,000+ members",
  },
];

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function FeatureCard({
  feature,
  index,
  span = 1,
}: {
  feature: typeof FEATURES[0];
  index: number;
  span?: number;
}) {
  const { ref, visible } = useReveal();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      style={{
        gridColumn: `span ${span}`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease-out ${index * 0.08}s, transform 0.6s ease-out ${index * 0.08}s`,
      }}
      className={`feature-card-col-${span}`}
    >
      <div
        style={{
          background: hovered ? "#FFFFFF" : "#FFFFFF",
          border: `1px solid ${hovered ? feature.color + "35" : "#E2E8F0"}`,
          borderRadius: "20px",
          padding: span === 2 ? "32px" : "24px",
          height: "100%",
          cursor: "default",
          transition: "all 0.3s ease",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          boxShadow: hovered ? `0 20px 60px ${feature.color}12` : "0 1px 2px rgba(15,23,42,0.04)",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Glow corner */}
        <div style={{
          position: "absolute",
          top: -60, right: -60,
          width: "160px", height: "160px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${feature.color}${hovered ? "20" : "0d"} 0%, transparent 70%)`,
          transition: "all 0.4s",
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{
            width: span === 2 ? "56px" : "48px",
            height: span === 2 ? "56px" : "48px",
            borderRadius: "14px",
            background: `${feature.color}18`,
            border: `1px solid ${feature.color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: span === 2 ? "26px" : "22px",
            transition: "transform 0.3s ease",
            transform: hovered ? "scale(1.1) rotate(-3deg)" : "scale(1) rotate(0)",
          }}>
            {feature.icon}
          </div>
          <span style={{
            fontSize: "10px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: feature.color,
            background: `${feature.color}15`,
            border: `1px solid ${feature.color}25`,
            borderRadius: "999px",
            padding: "3px 10px",
            whiteSpace: "nowrap",
          }}>
            {feature.badge}
          </span>
        </div>

        <h3 style={{
          fontSize: span === 2 ? "20px" : "17px",
          fontWeight: 700,
          color: "#0F172A",
          marginBottom: "10px",
          lineHeight: 1.3,
        }}>
          {feature.title}
        </h3>

        <p style={{
          fontSize: "14px",
          color: "#475569",
          lineHeight: 1.65,
          marginBottom: "16px",
        }}>
          {feature.desc}
        </p>

        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          fontWeight: 700,
          color: feature.color,
        }}>
          <span style={{
            width: "6px", height: "6px",
            borderRadius: "50%",
            background: feature.color,
          }} />
          {feature.stat}
        </div>
      </div>
    </div>
  );
}

export function FeaturesGrid() {
  const header = useReveal();

  return (
    <section id="features" style={{ padding: "100px 24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div
        ref={header.ref}
        style={{
          textAlign: "center",
          marginBottom: "60px",
          opacity: header.visible ? 1 : 0,
          transform: header.visible ? "translateY(0)" : "translateY(24px)",
          transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
        }}
      >
        <div className={styles.eyebrow}>Features</div>
        <h2 className={styles.sectionTitle}>
          Everything You Need to{" "}
          <span className={styles.gradientText}>Deal Smarter</span>
        </h2>
        <p style={{ color: "#475569", fontSize: "17px", maxWidth: "500px", margin: "0 auto", lineHeight: 1.65 }}>
          ScrapIQ bundles AI recognition, live market data, and business intelligence in one platform.
        </p>
      </div>

      {/* Bento grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "20px",
      }} className="bento-grid">
        {/* Row 1: large + medium */}
        <FeatureCard feature={FEATURES[0]} index={0} span={2} />
        <FeatureCard feature={FEATURES[1]} index={1} span={1} />
        {/* Row 2: medium + 2 small */}
        <FeatureCard feature={FEATURES[2]} index={2} span={1} />
        <FeatureCard feature={FEATURES[3]} index={3} span={1} />
        <FeatureCard feature={FEATURES[4]} index={4} span={1} />
        {/* Row 3: full width */}
        <FeatureCard feature={FEATURES[5]} index={5} span={3} />
      </div>

      <style>{`
        @media (max-width: 900px) {
          .bento-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .feature-card-col-2,
          .feature-card-col-3 {
            grid-column: span 2 !important;
          }
        }
        @media (max-width: 560px) {
          .bento-grid {
            grid-template-columns: 1fr !important;
          }
          .feature-card-col-2,
          .feature-card-col-3 {
            grid-column: span 1 !important;
          }
        }
      `}</style>
    </section>
  );
}
