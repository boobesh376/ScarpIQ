"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./Landing.module.css";

const MATERIALS = [
  { name: "Copper Wire Bundle",  confidence: 97, value: "₹8,400",  tag: "High Grade",  color: "#FFB800" },
  { name: "Aluminum Sheets",     confidence: 94, value: "₹3,200",  tag: "Clean",       color: "#0EA5E9" },
  { name: "Stainless Steel",     confidence: 91, value: "₹4,800",  tag: "Grade 304",   color: "#64748B" },
  { name: "Iron Scrap",          confidence: 88, value: "₹1,950",  tag: "Mixed",       color: "#B45309" },
  { name: "Brass Fittings",      confidence: 96, value: "₹5,600",  tag: "Premium",     color: "#CA8A04" },
];

const ANALYSES = [
  { label: "Purity", value: 97 },
  { label: "Weight Est.", value: 82 },
  { label: "Market Fit", value: 93 },
];

export function HeroSection() {
  const [matIdx, setMatIdx] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanY, setScanY] = useState(0);
  const scanRef = useRef<number | null>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);

  // Cycle through materials every 3.5s
  useEffect(() => {
    const interval = setInterval(() => {
      setScanning(true);
      setScanComplete(false);
      setScanY(0);

      // Animate scan beam
      let y = 0;
      const tick = () => {
        y += 2;
        setScanY(y);
        if (y < 100) {
          scanRef.current = requestAnimationFrame(tick);
        } else {
          setScanComplete(true);
          setScanning(false);
          setMatIdx(i => (i + 1) % MATERIALS.length);
        }
      };
      scanRef.current = requestAnimationFrame(tick);
    }, 3500);

    return () => {
      clearInterval(interval);
      if (scanRef.current) cancelAnimationFrame(scanRef.current);
    };
  }, []);

  // Text reveal animation
  useEffect(() => {
    const el = headlineRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    const t = setTimeout(() => {
      el.style.transition = "opacity 0.9s cubic-bezier(0,0,0.2,1), transform 0.9s cubic-bezier(0,0,0.2,1)";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }, 100);
    return () => clearTimeout(t);
  }, []);

  const mat = MATERIALS[matIdx];

  return (
    <section style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
      padding: "120px 24px 64px",
    }}>
      {/* Background orbs */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
      }}>
        <div style={{
          position: "absolute",
          width: "600px", height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)",
          top: "-100px", left: "-100px",
          animation: "orb1 12s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute",
          width: "500px", height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)",
          bottom: "0", right: "0",
          animation: "orb2 15s ease-in-out infinite",
        }} />
        {/* Grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)",
        }} />
      </div>

      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "60px",
        alignItems: "center",
        position: "relative",
        zIndex: 1,
      }} className="hero-grid">

        {/* Left: Copy */}
        <div>
          {/* Announcement pill */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: "999px",
            padding: "6px 14px",
            marginBottom: "28px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#475569",
            letterSpacing: "0.04em",
          }}>
            <span style={{
              width: "6px", height: "6px",
              background: "#10B981",
              borderRadius: "50%",
              animation: "pulseRing 2s ease-out infinite",
              display: "inline-block",
            }} />
            AI-Powered Scrap Intelligence Platform
          </div>

          <h1
            ref={headlineRef}
            style={{
              fontSize: "clamp(40px, 7vw, 72px)",
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              marginBottom: "24px",
            }}
          >
            Know the Value{" "}
            <span className={styles.gradientText}>Before You Sell.</span>
          </h1>

          <p style={{
            fontSize: "clamp(16px, 2.5vw, 20px)",
            color: "#475569",
            lineHeight: 1.7,
            marginBottom: "36px",
            maxWidth: "480px",
          }}>
            ScrapIQ uses advanced AI to identify scrap materials from photos,
            estimate real-time market value, and deliver intelligence that gives
            you the advantage at every deal.
          </p>

          {/* CTA row */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "48px" }}>
            <Link href="/signup" className={styles.btnPrimary} style={{ fontSize: "16px", padding: "15px 32px" }}>
              Start Analyzing Free
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link href="/login" className={styles.btnSecondary} style={{ fontSize: "16px", padding: "15px 32px" }}>
              Sign In
            </Link>
          </div>

          {/* Trust indicators */}
          <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
            {[
              { icon: "🔒", text: "No credit card" },
              { icon: "⚡", text: "Results in 10 seconds" },
              { icon: "🌿", text: "95%+ accuracy" },
            ].map(t => (
              <div key={t.text} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px" }}>{t.icon}</span>
                <span style={{ fontSize: "13px", color: "#475569", fontWeight: 500 }}>{t.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: AI Scanner card */}
        <div style={{
          animation: "floatY 6s ease-in-out infinite",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}>
          {/* Main scanner card */}
          <div style={{
            background: "rgba(255,255,255,0.92)",
            border: "1px solid #E2E8F0",
            borderRadius: "20px",
            padding: "24px",
            backdropFilter: "blur(20px)",
            boxShadow: "0 32px 64px rgba(15,23,42,0.08), 0 0 0 1px rgba(16,185,129,0.06)",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Accent glow */}
            <div style={{
              position: "absolute", top: -60, right: -60,
              width: "200px", height: "200px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />

            {/* Card header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: "20px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "10px",
                  background: "linear-gradient(135deg, #10B981, #34D399)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px",
                }}>♻</div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>ScrapIQ AI</div>
                  <div style={{ fontSize: "11px", color: "#475569" }}>Material Scanner v2.4</div>
                </div>
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "#DCFCE7",
                border: "1px solid #A7F3D0",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#10B981",
              }}>
                <span style={{
                  width: "5px", height: "5px", background: "#10B981",
                  borderRadius: "50%", display: "inline-block",
                  animation: "blink 1.5s ease-in-out infinite",
                }} />
                LIVE
              </div>
            </div>

            {/* Scan area */}
            <div style={{
              position: "relative",
              height: "160px",
              background: "#F8FAFC",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              overflow: "hidden",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {/* Scan beam */}
              {scanning && (
                <div style={{
                  position: "absolute",
                  top: `${scanY}%`,
                  left: 0, right: 0,
                  height: "2px",
                  background: "linear-gradient(90deg, transparent, #10B981, #34D399, #10B981, transparent)",
                  zIndex: 2,
                  boxShadow: "0 0 12px rgba(16,185,129,0.4)",
                  transition: "none",
                }} />
              )}

              {/* Corner brackets */}
              {["top-left","top-right","bottom-left","bottom-right"].map(corner => (
                <div key={corner} style={{
                  position: "absolute",
                  width: "20px", height: "20px",
                  ...(corner.includes("top") ? { top: 12 } : { bottom: 12 }),
                  ...(corner.includes("left") ? { left: 12 } : { right: 12 }),
                  borderTop: corner.includes("top") ? "2px solid #10B981" : "none",
                  borderBottom: corner.includes("bottom") ? "2px solid #10B981" : "none",
                  borderLeft: corner.includes("left") ? "2px solid #10B981" : "none",
                  borderRight: corner.includes("right") ? "2px solid #10B981" : "none",
                }} />
              ))}

              {/* Material representation */}
              <div style={{ textAlign: "center", padding: "16px" }}>
                <div style={{
                  fontSize: "32px",
                  marginBottom: "8px",
                  filter: scanComplete ? "none" : "blur(0px)",
                  transition: "filter 0.4s",
                }}>
                  {matIdx === 0 ? "🔌" : matIdx === 1 ? "📋" : matIdx === 2 ? "⚙️" : matIdx === 3 ? "🔧" : "🔩"}
                </div>
                <div style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: scanComplete ? "#0F172A" : "#94A3B8",
                  transition: "color 0.4s",
                }}>
                  {mat.name}
                </div>
                <div style={{
                  display: "inline-block",
                  marginTop: "6px",
                  padding: "2px 10px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: `${mat.color}18`,
                  color: mat.color,
                  border: `1px solid ${mat.color}30`,
                }}>
                  {mat.tag}
                </div>
              </div>
            </div>

            {/* Analysis bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {ANALYSES.map((a, i) => (
                <div key={a.label}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: "11px", fontWeight: 600,
                    color: "#475569", marginBottom: "4px",
                  }}>
                    <span>{a.label}</span>
                    <span style={{ color: "#0F172A" }}>{a.value}%</span>
                  </div>
                  <div style={{
                    height: "4px", borderRadius: "2px",
                    background: "#E2E8F0",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%",
                      width: scanComplete ? `${a.value}%` : "0%",
                      background: i === 0 ? "linear-gradient(90deg, #10B981, #34D399)"
                               : i === 1 ? "linear-gradient(90deg, #34D399, #10B981)"
                               : `linear-gradient(90deg, ${mat.color}, #10B981)`,
                      borderRadius: "2px",
                      transition: `width ${0.6 + i * 0.15}s cubic-bezier(0,0,0.2,1) ${i * 0.1}s`,
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Result row */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              background: "#DCFCE7",
              borderRadius: "12px",
              border: "1px solid #A7F3D0",
            }}>
              <div>
                <div style={{ fontSize: "11px", color: "#475569", marginBottom: "2px" }}>
                  Estimated Value
                </div>
                <div style={{
                  fontSize: "22px", fontWeight: 800,
                  background: "linear-gradient(135deg, #0F172A, #10B981)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  opacity: scanComplete ? 1 : 0.3,
                  transition: "opacity 0.5s",
                }}>
                  {mat.value}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: "#475569", marginBottom: "2px" }}>
                  AI Confidence
                </div>
                <div style={{
                  fontSize: "22px", fontWeight: 800,
                  color: mat.confidence >= 95 ? "#10B981"
                       : mat.confidence >= 90 ? "#FFB800" : "#475569",
                  opacity: scanComplete ? 1 : 0.3,
                  transition: "opacity 0.5s",
                }}>
                  {mat.confidence}%
                </div>
              </div>
            </div>
          </div>

          {/* Floating mini cards */}
          <div style={{ display: "flex", gap: "12px" }}>
            {[
              { label: "Market Price", value: "Live", icon: "📈", col: "#7C3AED" },
              { label: "CO₂ Saved", value: "2.4 kg", icon: "🌿", col: "#10B981" },
            ].map(card => (
              <div key={card.label} style={{
                flex: 1,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid #E2E8F0",
                borderRadius: "14px",
                padding: "14px 16px",
                backdropFilter: "blur(20px)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}>
                <div style={{
                  width: "36px", height: "36px",
                  borderRadius: "10px",
                  background: `${card.col}18`,
                  border: `1px solid ${card.col}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px", flexShrink: 0,
                }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#475569", marginBottom: "2px" }}>{card.label}</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: card.col }}>{card.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 48px !important;
          }
        }
      `}</style>
    </section>
  );
}
