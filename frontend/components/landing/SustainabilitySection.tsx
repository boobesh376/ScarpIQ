"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Landing.module.css";

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function useCountUp(target: number, dur = 1600, start = false) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
    let t0: number | null = null;
    const raf = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * e));
      if (p < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [target, dur, start]);
  return v;
}

const IMPACT_STATS = [
  { value: 340,  suffix: "T",   label: "CO₂ Saved",      sub: "Tonnes of carbon avoided",     icon: "🌱", color: "#10B981" },
  { value: 12,   suffix: "MW",  label: "Energy Saved",    sub: "Equivalent megawatts",         icon: "⚡", color: "#FFB800" },
  { value: 5200, suffix: "+",   label: "Tons Recycled",   sub: "Through platform guidance",    icon: "♻️", color: "#34D399" },
  { value: 98,   suffix: "%",   label: "Circular Rate",   sub: "Material back in supply chain",icon: "🔄", color: "#7C3AED" },
];

export function SustainabilitySection() {
  const header = useReveal(0.1);
  const statsBlock = useReveal(0.2);

  const c0 = useCountUp(IMPACT_STATS[0].value, 1800, statsBlock.visible);
  const c1 = useCountUp(IMPACT_STATS[1].value, 1800, statsBlock.visible);
  const c2 = useCountUp(IMPACT_STATS[2].value, 1800, statsBlock.visible);
  const c3 = useCountUp(IMPACT_STATS[3].value, 1800, statsBlock.visible);
  const counts = [c0, c1, c2, c3];

  return (
    <section style={{ padding: "100px 24px", position: "relative", overflow: "hidden" }}>
      {/* Soft green glow bg */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "800px", height: "600px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative" }}>
        {/* Header */}
        <div
          ref={header.ref}
          style={{
            textAlign: "center",
            marginBottom: "72px",
            opacity: header.visible ? 1 : 0,
            transform: header.visible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
          }}
        >
          <div className={styles.eyebrow} style={{
            background: "#DCFCE7",
            border: "1px solid #A7F3D0",
            color: "#10B981",
          }}>
            Sustainability
          </div>
          <h2 className={styles.sectionTitle}>
            Every Scan Is a{" "}
            <span style={{
              background: "linear-gradient(135deg, #10B981, #34D399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Vote for the Planet
            </span>
          </h2>
          <p style={{ color: "#475569", fontSize: "17px", maxWidth: "520px", margin: "0 auto", lineHeight: 1.7 }}>
            Recycling scrap metal has a profound environmental impact. ScrapIQ makes it easy to measure, track, and share your contribution to a circular economy.
          </p>
        </div>

        {/* Impact stats */}
        <div
          ref={statsBlock.ref}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
            marginBottom: "60px",
          }}
        >
          {IMPACT_STATS.map((s, i) => (
            <div
              key={s.label}
              style={{
                padding: "28px 20px",
                background: `${s.color}08`,
                border: `1px solid ${s.color}20`,
                borderRadius: "20px",
                textAlign: "center",
                opacity: statsBlock.visible ? 1 : 0,
                transform: statsBlock.visible ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.5s ease-out ${i * 0.1}s, transform 0.5s ease-out ${i * 0.1}s`,
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "12px" }}>{s.icon}</div>
              <div style={{
                fontSize: "clamp(32px, 5vw, 44px)",
                fontWeight: 900,
                color: s.color,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                marginBottom: "6px",
              }}>
                {counts[i].toLocaleString("en-IN")}{s.suffix}
              </div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                {s.label}
              </div>
              <div style={{ fontSize: "12px", color: "#475569" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Big message card */}
        <div style={{
          background: "linear-gradient(135deg, rgba(0,200,150,0.06) 0%, rgba(0,179,131,0.06) 100%)",
          border: "1px solid rgba(0,200,150,0.14)",
          borderRadius: "24px",
          padding: "48px 40px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "48px",
          alignItems: "center",
        }} className="sus-card">

          <div>
            <div style={{
              fontSize: "clamp(22px, 4vw, 32px)",
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: "-0.03em",
              color: "#0F172A",
              marginBottom: "16px",
            }}>
              Recycling 1 ton of copper saves{" "}
              <span style={{ color: "#00C896" }}>85%</span>{" "}
              of the energy needed to mine it.
            </div>
            <p style={{ fontSize: "15px", color: "#475569", lineHeight: 1.7 }}>
              ScrapIQ helps you quantify your environmental contribution with every analysis.
              Your sustainability report is always one tap away.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[
              { label: "Energy Efficiency vs Mining", value: 85, color: "#00C896" },
              { label: "Landfill Diversion Rate",     value: 97, color: "#00B383" },
              { label: "Water Usage Reduction",        value: 74, color: "#0EA5E9" },
            ].map(bar => (
              <div key={bar.label}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: "13px", fontWeight: 600, color: "#475569",
                  marginBottom: "6px",
                }}>
                  <span>{bar.label}</span>
                  <span style={{ color: bar.color }}>{bar.value}%</span>
                </div>
                <div style={{
                  height: "6px", borderRadius: "3px",
                  background: "#E2E8F0",
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${bar.value}%`,
                    background: `linear-gradient(90deg, ${bar.color}, ${bar.color}80)`,
                    borderRadius: "3px",
                    transition: "width 1.2s cubic-bezier(0,0,0.2,1)",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sus-card { grid-template-columns: 1fr !important; gap: 28px !important; padding: 28px 24px !important; }
        }
      `}</style>
    </section>
  );
}
