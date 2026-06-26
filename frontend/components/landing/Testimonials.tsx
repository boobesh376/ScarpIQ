"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Landing.module.css";

const TESTIMONIALS = [
  {
    name: "Rajesh Mehta",
    role: "Scrap Dealer, Mumbai",
    avatar: "RM",
    color: "#00B383",
    rating: 5,
    text: "Before ScrapIQ I'd lose ₹2,000–₹5,000 on a deal just because I misjudged the material grade. Now I scan, verify, and negotiate from a position of knowledge. My margins are up 18% in three months.",
    highlight: "Margins up 18%",
  },
  {
    name: "Priya Krishnan",
    role: "Recycling Plant Manager, Chennai",
    avatar: "PK",
    color: "#0EA5E9",
    rating: 5,
    text: "The material identification accuracy is remarkable. We've integrated ScrapIQ into our intake process and reduced misclassification by 94%. Our operational efficiency has transformed completely.",
    highlight: "94% fewer misclassifications",
  },
  {
    name: "Arjun Patel",
    role: "Industrial Scrap Aggregator, Ahmedabad",
    avatar: "AP",
    color: "#FFB800",
    rating: 5,
    text: "The market intelligence feature alone is worth the subscription. Knowing when copper is trending up vs. when to hold changes everything about our buying decisions. Real competitive advantage.",
    highlight: "Real competitive advantage",
  },
  {
    name: "Sunita Rao",
    role: "Sustainability Director, Bengaluru",
    avatar: "SR",
    color: "#10B981",
    rating: 5,
    text: "We use ScrapIQ for our ESG reporting. The CO₂ impact tracking is credible, exportable, and saves our team hours each week. Finally, sustainability reporting for recycling that actually works.",
    highlight: "Saves hours each week",
  },
  {
    name: "Vikram Singh",
    role: "Scrap Yard Owner, Delhi",
    avatar: "VS",
    color: "#7C3AED",
    rating: 5,
    text: "I was skeptical about AI for scrap. Tried it once, it correctly identified a rare aluminum alloy I would have undervalued by ₹800/kg. Paid for months of use in a single scan. Absolutely blown away.",
    highlight: "Saved ₹800/kg on one scan",
  },
  {
    name: "Meera Joshi",
    role: "E-Waste Recycler, Pune",
    avatar: "MJ",
    color: "#EC4899",
    rating: 5,
    text: "The community feature helped me connect with other recyclers and find better buyers for specialty materials. ScrapIQ is more than a tool — it's built a whole ecosystem around scrap intelligence.",
    highlight: "Built an ecosystem",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="#FFB800">
          <path d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.44L7 8.88l-3.09 1.63.59-3.44L2 4.635l3.455-.505L7 1z"/>
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({ t, index }: { t: typeof TESTIMONIALS[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

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

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease-out ${index * 0.08}s, transform 0.6s ease-out ${index * 0.08}s`,
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          border: `1px solid ${hovered ? t.color + "30" : "#E2E8F0"}`,
          borderRadius: "20px",
          padding: "28px",
          height: "100%",
          cursor: "default",
          transition: "all 0.3s ease",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          boxShadow: hovered ? `0 16px 48px ${t.color}12` : "0 1px 3px rgba(15,23,42,0.05)",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Quote mark */}
        <div style={{
          position: "absolute",
          top: 16, right: 20,
          fontSize: "56px",
          lineHeight: 1,
          color: `${t.color}15`,
          fontFamily: "Georgia, serif",
          fontWeight: 900,
          pointerEvents: "none",
          transition: "color 0.3s",
        }}>
          "
        </div>

        <div style={{ marginBottom: "16px" }}>
          <Stars count={t.rating} />
        </div>

        <p style={{
          fontSize: "14px",
          color: "#475569",
          lineHeight: 1.75,
          marginBottom: "20px",
          fontStyle: "italic",
        }}>
          "{t.text}"
        </p>

        {/* Highlight badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 12px",
          background: `${t.color}12`,
          border: `1px solid ${t.color}25`,
          borderRadius: "999px",
          fontSize: "11px",
          fontWeight: 700,
          color: t.color,
          marginBottom: "20px",
        }}>
          ✦ {t.highlight}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "40px", height: "40px",
            borderRadius: "12px",
            background: `${t.color}25`,
            border: `1px solid ${t.color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px",
            fontWeight: 800,
            color: t.color,
            flexShrink: 0,
          }}>
            {t.avatar}
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{t.name}</div>
            <div style={{ fontSize: "12px", color: "#475569" }}>{t.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Testimonials() {
  const header = useRef<HTMLDivElement>(null);
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    const el = header.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setHeaderVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="community" style={{
      background: "#F1F5F9",
      borderTop: "1px solid #E2E8F0",
      borderBottom: "1px solid #E2E8F0",
      padding: "100px 24px",
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div
          ref={header}
          style={{
            textAlign: "center",
            marginBottom: "64px",
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
          }}
        >
          <div className={styles.eyebrow}>Testimonials</div>
          <h2 className={styles.sectionTitle}>
            Trusted by Scrap Professionals{" "}
            <span className={styles.gradientText}>Across India</span>
          </h2>
          <p style={{ color: "#475569", fontSize: "17px", maxWidth: "480px", margin: "0 auto", lineHeight: 1.65 }}>
            From yard owners to sustainability managers, ScrapIQ is changing how the industry operates.
          </p>
        </div>

        {/* Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
        }}>
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={t.name} t={t} index={i} />
          ))}
        </div>

        {/* Social proof row */}
        <div style={{
          marginTop: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "32px",
          flexWrap: "wrap",
        }}>
          {[
            { icon: "⭐", stat: "4.9/5", label: "Average Rating" },
            { icon: "👥", stat: "5,000+", label: "Active Users" },
            { icon: "📊", stat: "124K+", label: "Analyses Done" },
          ].map(item => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "12px 20px",
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
            }}>
              <span style={{ fontSize: "20px" }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>{item.stat}</div>
                <div style={{ fontSize: "12px", color: "#475569" }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
