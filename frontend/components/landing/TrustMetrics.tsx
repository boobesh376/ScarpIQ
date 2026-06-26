"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Landing.module.css";

const METRICS = [
  { value: 124000, suffix: "+", label: "Analyses Completed",    icon: "🔬", color: "#10B981" },
  { value: 47,     suffix: "",  label: "Material Categories",   icon: "📦", color: "#7C3AED" },
  { value: 97,     suffix: "%", label: "Valuation Accuracy",    icon: "🎯", color: "#FFB800" },
  { value: 8.4,    suffix: "Cr", label: "Est. Value Generated", icon: "💰", color: "#0EA5E9" },
];

function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const isDecimal = !Number.isInteger(target);
    const raf = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      setCount(isDecimal ? Math.round(current * 10) / 10 : Math.floor(current));
      if (progress < 1) requestAnimationFrame(raf);
      else setCount(target);
    };
    requestAnimationFrame(raf);
  }, [target, duration, start]);
  return count;
}

function MetricCard({ metric, index }: { metric: typeof METRICS[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const count = useCountUp(metric.value, 1800 + index * 100, visible);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const display = metric.value < 10
    ? count.toFixed(1)
    : count.toLocaleString("en-IN");

  return (
    <div
      ref={ref}
      style={{
        textAlign: "center",
        padding: "36px 24px",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "20px",
        transition: "border-color 0.3s, transform 0.3s",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `${metric.color}40`;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#E2E8F0";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* Glow */}
      <div style={{
        position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)",
        width: "120px", height: "120px",
        borderRadius: "50%",
        background: `radial-gradient(circle, ${metric.color}12 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{
        width: "52px", height: "52px",
        borderRadius: "14px",
        background: `${metric.color}18`,
        border: `1px solid ${metric.color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "24px",
        margin: "0 auto 20px",
      }}>
        {metric.icon}
      </div>

      <div style={{
        fontSize: "clamp(36px, 5vw, 52px)",
        fontWeight: 900,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        marginBottom: "8px",
        background: `linear-gradient(135deg, ${metric.color}, ${metric.color}aa)`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        animation: visible ? "counterUp 0.4s ease-out" : "none",
      }}>
        {display}{metric.suffix}
      </div>
      <div style={{
        fontSize: "14px",
        color: "#475569",
        fontWeight: 500,
        letterSpacing: "0.01em",
      }}>
        {metric.label}
      </div>
    </div>
  );
}

export function TrustMetrics() {
  return (
    <section style={{
      background: "#F1F5F9",
      borderTop: "1px solid #E2E8F0",
      borderBottom: "1px solid #E2E8F0",
    }}>
      <div className={styles.section} style={{ paddingTop: "72px", paddingBottom: "72px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
        }}>
          {METRICS.map((m, i) => (
            <MetricCard key={m.label} metric={m} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
