"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Landing.module.css";

const FAQS = [
  {
    q: "How accurate is ScrapIQ's material identification?",
    a: "Our AI model achieves 97%+ accuracy on common scrap metals including copper, aluminum, steel, brass, and iron. For specialty alloys and mixed materials, we provide confidence scores so you always know how certain the analysis is. The model is continuously trained on new data to improve over time.",
  },
  {
    q: "Where does the pricing data come from?",
    a: "ScrapIQ aggregates live pricing feeds from major Indian scrap exchanges and regional markets. Prices are updated hourly and reflect real-world buying rates from verified dealers. We show both spot prices and 6-week trend data to help you time your sales effectively.",
  },
  {
    q: "Do I need special equipment or a professional camera?",
    a: "No — your smartphone camera is all you need. Our AI is trained to work with real-world photos taken in varying lighting conditions, from different angles, and even with partial obstructions. The better the photo, the higher the confidence score, but we handle everyday conditions with ease.",
  },
  {
    q: "Is ScrapIQ suitable for large-scale industrial operations?",
    a: "Absolutely. ScrapIQ is used by individual dealers, recycling plants, and large industrial aggregators alike. For bulk operations, we provide batch analysis capabilities and detailed CSV export for integration with existing ERP systems.",
  },
  {
    q: "How does the sustainability tracking work?",
    a: "Each analysis automatically calculates the environmental impact of recycling vs. primary production — including CO₂ saved, energy conserved, and water usage reduced. These metrics follow established ISO standards and can be exported for ESG reporting.",
  },
  {
    q: "Is my data secure and private?",
    a: "Yes. All images are processed securely and are not shared with third parties. Analysis data is stored encrypted and associated only with your account. You can delete your history at any time. We never sell user data.",
  },
  {
    q: "Can I use ScrapIQ offline?",
    a: "The AI analysis requires an internet connection for the most accurate, live-price-integrated results. However, your analysis history is cached and accessible offline. We're actively working on an offline-capable mode for areas with limited connectivity.",
  },
];

function FaqItem({ faq, index }: { faq: typeof FAQS[0]; index: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

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

  // Smooth height animation
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (open) {
      el.style.maxHeight = el.scrollHeight + "px";
      el.style.opacity = "1";
    } else {
      el.style.maxHeight = "0";
      el.style.opacity = "0";
    }
  }, [open]);

  return (
    <div
      ref={ref}
      style={{
        borderBottom: "1px solid #E2E8F0",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.5s ease-out ${index * 0.06}s, transform 0.5s ease-out ${index * 0.06}s`,
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          padding: "22px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          minHeight: "auto",
        }}
      >
        <span style={{
          fontSize: "16px",
          fontWeight: 600,
          color: open ? "#0F172A" : "#1E293B",
          lineHeight: 1.4,
          transition: "color 0.2s",
        }}>
          {faq.q}
        </span>

        <div style={{
          width: "28px", height: "28px",
          borderRadius: "8px",
          background: open ? "rgba(0,200,150,0.12)" : "#F1F5F9",
          border: `1px solid ${open ? "rgba(0,200,150,0.3)" : "#E2E8F0"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.25s ease",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 2v8M2 6h8"
              stroke={open ? "#00B383" : "#64748B"}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </button>

      <div
        ref={bodyRef}
        style={{
          maxHeight: "0",
          opacity: "0",
          overflow: "hidden",
          transition: "max-height 0.35s cubic-bezier(0,0,0.2,1), opacity 0.3s ease",
        }}
      >
        <p style={{
          fontSize: "15px",
          color: "#475569",
          lineHeight: 1.75,
          paddingBottom: "22px",
        }}>
          {faq.a}
        </p>
      </div>
    </div>
  );
}

export function FaqSection() {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setHeaderVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section style={{ padding: "100px 24px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Header */}
        <div
          ref={headerRef}
          style={{
            textAlign: "center",
            marginBottom: "60px",
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
          }}
        >
          <div className={styles.eyebrow}>FAQ</div>
          <h2 className={styles.sectionTitle}>
            Common <span className={styles.gradientText}>Questions</span>
          </h2>
          <p style={{ color: "#475569", fontSize: "17px", lineHeight: 1.65 }}>
            Everything you need to know about ScrapIQ. Can't find your answer?{" "}
            <a href="mailto:support@scrapiq.in" style={{ color: "#00B383", textDecoration: "none", fontWeight: 600 }}>
              Contact us.
            </a>
          </p>
        </div>

        {/* Accordion */}
        <div style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "20px",
          padding: "0 28px",
          boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
        }}>
          {FAQS.map((faq, i) => (
            <FaqItem key={i} faq={faq} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
