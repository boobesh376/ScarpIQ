"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Landing.module.css";

const STEPS = [
  {
    number: "01",
    title: "Upload Your Scrap Photo",
    desc: "Snap a photo or upload an image from your device. Works with any angle, any lighting — our AI handles the rest.",
    icon: "📸",
    color: "#00B383",
    detail: ["Supports JPG, PNG, HEIC", "Works in poor lighting", "Multi-item detection"],
  },
  {
    number: "02",
    title: "AI Identifies the Material",
    desc: "Our vision model instantly recognizes scrap type, grade, and condition — trained on millions of real scrap images.",
    icon: "🤖",
    color: "#7C3AED",
    detail: ["47 material categories", "Purity estimation", "Condition grading A–D"],
  },
  {
    number: "03",
    title: "Real-Time Market Intelligence",
    desc: "ScrapIQ cross-references live pricing data from regional and national scrap markets to give you the current rate.",
    icon: "📊",
    color: "#FFB800",
    detail: ["Regional price feeds", "Demand forecasting", "Historical trends"],
  },
  {
    number: "04",
    title: "Get Your Accurate Valuation",
    desc: "Receive a detailed breakdown — price per kg, total estimate, market comparison, and sustainability score.",
    icon: "💡",
    color: "#0EA5E9",
    detail: ["Price per kg + total", "Confidence interval", "Best time to sell"],
  },
];

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

export function HowItWorks() {
  const header = useReveal();

  return (
    <section id="how-it-works" style={{
      padding: "100px 24px",
      maxWidth: "1200px",
      margin: "0 auto",
    }}>
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
        <div className={styles.eyebrow}>How It Works</div>
        <h2 className={styles.sectionTitle}>
          From Photo to{" "}
          <span className={styles.gradientText}>Valuation in Seconds</span>
        </h2>
        <p className={styles.sectionSubtitle} style={{ margin: "0 auto", maxWidth: "500px", color: "#475569" }}>
          A seamless four-step process powered by computer vision and live market data.
        </p>
      </div>

      {/* Steps */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "24px",
        position: "relative",
      }}>
        {/* Connector line (desktop only) */}
        <div style={{
          position: "absolute",
          top: "52px",
          left: "calc(12.5% + 24px)",
          right: "calc(12.5% + 24px)",
          height: "1px",
          background: "linear-gradient(90deg, #00B38333, #7C3AED33, #FFB80033, #0EA5E933)",
          zIndex: 0,
          display: "var(--connector-display, block)",
        }} />

        {STEPS.map((step, i) => <StepCard key={step.number} step={step} index={i} />)}
      </div>

      <style>{`
        @media (max-width: 900px) { [style*="--connector-display"] { display: none !important; } }
      `}</style>
    </section>
  );
}

function StepCard({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const { ref, visible } = useReveal();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        zIndex: 1,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.6s ease-out ${index * 0.12}s, transform 0.6s ease-out ${index * 0.12}s`,
      }}
    >
      <div
        style={{
          background: hovered ? "#FFFFFF" : "#FFFFFF",
          border: `1px solid ${hovered ? step.color + "40" : "#E2E8F0"}`,
          borderRadius: "20px",
          padding: "28px 24px",
          transition: "all 0.3s ease",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          boxShadow: hovered ? `0 16px 40px ${step.color}1A` : "0 1px 2px rgba(15,23,42,0.04)",
          cursor: "default",
          height: "100%",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Step number */}
        <div style={{
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.1em",
          color: step.color,
          marginBottom: "16px",
          opacity: 0.7,
        }}>
          STEP {step.number}
        </div>

        {/* Icon circle */}
        <div style={{
          width: "56px", height: "56px",
          borderRadius: "16px",
          background: `${step.color}18`,
          border: `1px solid ${step.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "26px",
          marginBottom: "20px",
          transition: "transform 0.3s ease, background 0.3s ease",
          transform: hovered ? "scale(1.08)" : "scale(1)",
        }}>
          {step.icon}
        </div>

        <h3 style={{
          fontSize: "17px",
          fontWeight: 700,
          color: "#0F172A",
          marginBottom: "10px",
          lineHeight: 1.3,
        }}>
          {step.title}
        </h3>

        <p style={{
          fontSize: "14px",
          color: "#475569",
          lineHeight: 1.65,
          marginBottom: "20px",
        }}>
          {step.desc}
        </p>

        {/* Detail list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {step.detail.map(d => (
            <div key={d} style={{
              display: "flex", alignItems: "center", gap: "8px",
              fontSize: "12px", color: "#475569",
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" fill={`${step.color}20`} stroke={`${step.color}40`} strokeWidth="1"/>
                <path d="M4.5 7l2 2 3-3" stroke={step.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
