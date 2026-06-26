"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./Landing.module.css";

export function FinalCta() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section style={{
      padding: "80px 24px 120px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background gradient */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,200,150,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "linear-gradient(rgba(15,23,42,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.025) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)",
        pointerEvents: "none",
      }} />

      <div
        ref={ref}
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          textAlign: "center",
          position: "relative",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(32px)",
          transition: "opacity 0.8s ease-out, transform 0.8s ease-out",
        }}
      >
        {/* Eyebrow */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(0,200,150,0.08)",
          border: "1px solid rgba(0,200,150,0.25)",
          borderRadius: "999px",
          padding: "6px 16px",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color: "#475569",
          marginBottom: "28px",
        }}>
          <span style={{
            width: "6px", height: "6px",
            background: "#00C896",
            borderRadius: "50%",
            display: "inline-block",
            animation: "ctaPulse 2s ease-in-out infinite",
          }} />
          Start Free Today
        </div>

        {/* Headline */}
        <h2 style={{
          fontSize: "clamp(36px, 7vw, 64px)",
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: "-0.04em",
          marginBottom: "24px",
        }}>
          Stop Guessing.{" "}
          <span style={{
            background: "linear-gradient(135deg, #00B383, #5EEAD4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Start Knowing.
          </span>
        </h2>

        <p style={{
          fontSize: "clamp(16px, 2.5vw, 20px)",
          color: "#475569",
          lineHeight: 1.7,
          maxWidth: "520px",
          margin: "0 auto 44px",
        }}>
          Join 5,000+ scrap professionals using AI to value materials faster, negotiate better, and profit more.
          Your first analysis is free — no card required.
        </p>

        {/* CTA buttons */}
        <div style={{
          display: "flex",
          gap: "14px",
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: "40px",
        }}>
          <Link
            href="/signup"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "18px 36px",
              background: "linear-gradient(135deg, #00C896, #00B383)",
              color: "#fff",
              fontSize: "17px",
              fontWeight: 800,
              borderRadius: "12px",
              textDecoration: "none",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              boxShadow: "0 4px 24px rgba(0,200,150,0.35)",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-3px)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 12px 36px rgba(0,200,150,0.5)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 24px rgba(0,200,150,0.35)";
            }}
          >
            Start Analyzing Free
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9h12M11 5l4 4-4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "18px 32px",
              background: "#FFFFFF",
              color: "#0F172A",
              fontSize: "17px",
              fontWeight: 700,
              borderRadius: "12px",
              textDecoration: "none",
              border: "1px solid #E2E8F0",
              transition: "border-color 0.2s, background 0.2s, transform 0.2s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "#CBD5E1";
              (e.currentTarget as HTMLAnchorElement).style.background = "#F1F5F9";
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "#E2E8F0";
              (e.currentTarget as HTMLAnchorElement).style.background = "#FFFFFF";
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
            }}
          >
            Sign In to Dashboard
          </Link>
        </div>

        {/* Trust chips */}
        <div style={{
          display: "flex",
          gap: "20px",
          justifyContent: "center",
          flexWrap: "wrap",
        }}>
          {[
            "✓ No credit card required",
            "✓ Free forever tier",
            "✓ Cancel anytime",
          ].map(t => (
            <span key={t} style={{
              fontSize: "13px",
              color: "#64748B",
              fontWeight: 500,
            }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ctaPulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }
      `}</style>
    </section>
  );
}
