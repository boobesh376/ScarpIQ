"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Landing.module.css";

const MATERIALS_DATA = [
  { name: "Copper",    price: 700,  change: +4.2, trend: [620, 640, 660, 650, 680, 700], color: "#FFB800", unit: "₹/kg" },
  { name: "Aluminum",  price: 200,  change: +1.8, trend: [180, 185, 190, 188, 195, 200], color: "#0EA5E9", unit: "₹/kg" },
  { name: "Steel",     price: 38,   change: -0.6, trend: [40,  39,  38,  39,  38,  38], color: "#475569", unit: "₹/kg" },
  { name: "Brass",     price: 400,  change: +2.9, trend: [370, 375, 385, 390, 395, 400], color: "#CA8A04", unit: "₹/kg" },
  { name: "Iron",      price: 25,   change: +0.4, trend: [24,  24,  25,  24,  25,  25], color: "#B45309", unit: "₹/kg" },
  { name: "Stainless", price: 85,   change: +1.1, trend: [80,  81,  82,  83,  84,  85], color: "#94A3B8", unit: "₹/kg" },
];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80, h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{ overflow: "visible" }}>
      <polyline
        points={pts}
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      {(() => {
        const last = data[data.length - 1];
        const x = w;
        const y = h - ((last - min) / range) * h;
        return <circle cx={x} cy={y} r="3" fill={color} />;
      })()}
    </svg>
  );
}

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

export function MarketIntelligence() {
  const header = useReveal();
  const body = useReveal();
  const [selected, setSelected] = useState(0);
  const mat = MATERIALS_DATA[selected];

  // Simple bar chart for selected material trend
  const barMax = Math.max(...mat.trend);
  const barMin = Math.min(...mat.trend) * 0.9;

  return (
    <section style={{
      background: "#F1F5F9",
      borderTop: "1px solid #F1F5F9",
      borderBottom: "1px solid #F1F5F9",
      padding: "100px 24px",
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div
          ref={header.ref}
          style={{
            textAlign: "center",
            marginBottom: "64px",
            opacity: header.visible ? 1 : 0,
            transform: header.visible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
          }}
        >
          <div className={styles.eyebrow}>Market Intelligence</div>
          <h2 className={styles.sectionTitle}>
            Live Pricing,{" "}
            <span className={styles.gradientText}>Smarter Decisions</span>
          </h2>
          <p style={{ color: "#64748B", fontSize: "17px", maxWidth: "480px", margin: "0 auto", lineHeight: 1.65 }}>
            Track material prices across Indian markets in real time. ScrapIQ intelligence means you always know the right moment to sell.
          </p>
        </div>

        <div
          ref={body.ref}
          style={{
            opacity: body.visible ? 1 : 0,
            transform: body.visible ? "translateY(0)" : "translateY(28px)",
            transition: "opacity 0.7s ease-out 0.15s, transform 0.7s ease-out 0.15s",
          }}
        >
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr",
            gap: "28px",
            alignItems: "start",
          }} className="market-grid">

            {/* Left: price table */}
            <div style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "20px",
              overflow: "hidden",
            }}>
              <div style={{
                padding: "16px 20px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>Live Scrap Prices</span>
                <div style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  fontSize: "11px", fontWeight: 700, color: "#00B383",
                  background: "rgba(0,200,150,0.08)",
                  border: "1px solid rgba(0,200,150,0.2)",
                  borderRadius: "6px",
                  padding: "3px 9px",
                }}>
                  <span style={{
                    width: "5px", height: "5px", background: "#00B383",
                    borderRadius: "50%", animation: "blink 1.5s infinite",
                    display: "inline-block",
                  }} />
                  LIVE
                </div>
              </div>

              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 60px 90px",
                padding: "10px 20px",
                gap: "8px",
                borderBottom: "1px solid #F1F5F9",
              }}>
                {["Material", "Price", "24h", "Trend"].map(h => (
                  <div key={h} style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {h}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {MATERIALS_DATA.map((m, i) => (
                <button
                  key={m.name}
                  onClick={() => setSelected(i)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 80px 60px 90px",
                    gap: "8px",
                    padding: "14px 20px",
                    width: "100%",
                    background: selected === i ? `${m.color}0d` : "transparent",
                    borderLeft: selected === i ? `3px solid ${m.color}` : "3px solid transparent",
                    borderTop: "none",
                    borderRight: "none",
                    borderBottom: i < MATERIALS_DATA.length - 1 ? "1px solid #F1F5F9" : "none",
                    cursor: "pointer",
                    alignItems: "center",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                    minHeight: "auto",
                  }}
                  onMouseEnter={e => {
                    if (selected !== i)
                      (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC";
                  }}
                  onMouseLeave={e => {
                    if (selected !== i)
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "8px", height: "8px", borderRadius: "50%",
                      background: m.color, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>{m.name}</span>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                    {m.unit.split("/")[0]}{m.price}
                  </div>
                  <div style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: m.change >= 0 ? "#00B383" : "#EF4444",
                  }}>
                    {m.change >= 0 ? "+" : ""}{m.change}%
                  </div>
                  <div>
                    <Sparkline data={m.trend} color={m.color} />
                  </div>
                </button>
              ))}
            </div>

            {/* Right: chart detail */}
            <div style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "20px",
              padding: "24px",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "4px", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700 }}>
                    {mat.name} — 6 Week Trend
                  </div>
                  <div style={{
                    fontSize: "32px", fontWeight: 900, letterSpacing: "-0.03em",
                    color: mat.color,
                  }}>
                    ₹{mat.price}<span style={{ fontSize: "14px", fontWeight: 500, color: "#64748B" }}>/kg</span>
                  </div>
                </div>
                <div style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  background: mat.change >= 0 ? "rgba(0,200,150,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${mat.change >= 0 ? "rgba(0,200,150,0.2)" : "rgba(239,68,68,0.18)"}`,
                  fontSize: "16px",
                  fontWeight: 800,
                  color: mat.change >= 0 ? "#00B383" : "#EF4444",
                }}>
                  {mat.change >= 0 ? "▲" : "▼"} {Math.abs(mat.change)}%
                </div>
              </div>

              {/* Bar chart */}
              <div style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "8px",
                height: "140px",
                padding: "12px 0",
                borderBottom: "1px solid #E2E8F0",
                marginBottom: "16px",
              }}>
                {mat.trend.map((v, i) => {
                  const pct = ((v - barMin) / (barMax - barMin)) * 100;
                  const isLast = i === mat.trend.length - 1;
                  return (
                    <div key={i} style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                      height: "100%",
                      justifyContent: "flex-end",
                    }}>
                      <div style={{
                        width: "100%",
                        height: `${pct}%`,
                        minHeight: "4px",
                        borderRadius: "4px 4px 0 0",
                        background: isLast
                          ? mat.color
                          : `${mat.color}55`,
                        transition: "height 0.8s cubic-bezier(0,0,0.2,1)",
                        position: "relative",
                      }}>
                        {isLast && (
                          <div style={{
                            position: "absolute",
                            top: -22,
                            left: "50%",
                            transform: "translateX(-50%)",
                            fontSize: "10px",
                            fontWeight: 800,
                            color: mat.color,
                            whiteSpace: "nowrap",
                          }}>
                            ₹{v}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 500 }}>
                        W{i + 1}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                {[
                  { label: "52W High", value: `₹${Math.round(mat.price * 1.15)}` },
                  { label: "52W Low",  value: `₹${Math.round(mat.price * 0.78)}` },
                  { label: "Volume",   value: "High" },
                ].map(s => (
                  <div key={s.label} style={{
                    textAlign: "center",
                    padding: "10px",
                    background: "#F8FAFC",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                  }}>
                    <div style={{ fontSize: "10px", color: "#94A3B8", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#0F172A" }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .market-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </section>
  );
}
