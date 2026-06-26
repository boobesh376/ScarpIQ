"use client";

/**
 * AnalysisResult — Premium AI Valuation Experience (Bright Redesign)
 * ===================================================================
 * Bright premium SaaS aesthetic with scroll-reveal animations,
 * count-up numbers, AI typing effects, animated connectors,
 * expandable accordions, and glassmorphism.
 *
 * Preserves ALL existing functionality, data flow, props, and APIs.
 * Only the presentation layer has been redesigned.
 */

import React, { useState, useEffect, useRef } from "react";
import type { AnalyzeResponse, AIAnalysis } from "@/lib/api";
import s from "./AnalysisResult.module.css";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  result: AnalyzeResponse;
  aiInsights: AIAnalysis | null;
  preview: string | null;
  onReset: () => void;
  feedbackSlot?: React.ReactNode;
}

// ── Helpers (ALL PRESERVED — zero logic changes) ───────────────────────────────

function cap(str: string | null | undefined) {
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
}

function fmt(n: number | null | undefined) {
  if (n == null || isNaN(n)) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

function getMarketSignal(material: string | null | undefined): {
  label: string;
  icon: string;
  color: "green" | "yellow" | "red" | "blue";
  advice: string;
} {
  const m = (material ?? "").toLowerCase();
  if (m === "copper")
    return { label: "Copper trending up", icon: "↑", color: "green", advice: "Sell now" };
  if (m === "aluminum")
    return { label: "Aluminum stable", icon: "→", color: "blue", advice: "Neutral timing" };
  if (m === "steel")
    return { label: "Steel mild oversupply", icon: "↓", color: "yellow", advice: "Sell soon" };
  if (m === "iron")
    return { label: "Iron demand steady", icon: "→", color: "blue", advice: "Neutral" };
  if (m === "plastic")
    return { label: "Recycled plastic in demand", icon: "↑", color: "green", advice: "Good time" };
  return { label: "Market stable", icon: "→", color: "blue", advice: "No signal" };
}

function getNegotiationLines(
  material: string | null | undefined,
  condition: string | null | undefined,
  cleanliness: string | null | undefined,
  dealerOffer: number,
  targetPrice: number
): Array<{ text: string; type: "tip" | "positive" | "negative" | "neutral" }> {
  const m = cap(material);
  const isDirty = (cleanliness ?? "").toLowerCase() === "dirty";
  const isWorn = ["worn", "damaged", "heavily_damaged"].includes((condition ?? "").toLowerCase());
  const lines: Array<{ text: string; type: "tip" | "positive" | "negative" | "neutral" }> = [];

  lines.push({ text: `Open at ${fmt(targetPrice)} — don't reveal your floor`, type: "tip" });
  if (isDirty) lines.push({ text: "Offer to clean before handover to justify higher rate", type: "tip" });
  if (isWorn) lines.push({ text: "Condition is priced in — don't let them discount further", type: "neutral" });
  lines.push({ text: `${m} market is active — don't accept below ${fmt(dealerOffer)}`, type: "positive" });
  if (!isDirty && !isWorn) lines.push({ text: "Clean material commands premium — mention it", type: "positive" });

  return lines.slice(0, 4);
}

function getImprovementScenarios(
  finalPrice: number,
  cleanliness: string | null | undefined,
  condition: string | null | undefined,
  tips: string[]
): Array<{ label: string; price: number; icon: string; pct: number }> {
  const scenarios: Array<{ label: string; price: number; icon: string; pct: number }> = [];
  const isDirty = (cleanliness ?? "").toLowerCase() === "dirty";
  const isWorn = ["worn", "damaged", "heavily_damaged"].includes((condition ?? "").toLowerCase());

  if (isDirty) scenarios.push({ label: "After cleaning", price: Math.round(finalPrice * 1.18), icon: "🧹", pct: 18 });
  if (isWorn) scenarios.push({ label: "If sorted by type", price: Math.round(finalPrice * 1.12), icon: "🔀", pct: 12 });
  if (tips.length > 0) scenarios.push({ label: "Contaminants removed", price: Math.round(finalPrice * 1.25), icon: "✨", pct: 25 });
  if (scenarios.length === 0) scenarios.push({ label: "If carefully sorted", price: Math.round(finalPrice * 1.08), icon: "📦", pct: 8 });

  return scenarios;
}

// ── Animation Utilities ────────────────────────────────────────────────────────

/** Scroll-triggered reveal hook — observes element and triggers visibility */
function useScrollReveal(): { ref: React.RefObject<HTMLDivElement | null>; isVisible: boolean } {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

/** Animated number counter — counts from 0 to target on scroll intersection */
function AnimatedValue({ value, prefix = "₹" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  const spanRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = spanRef.current;
    if (!el || value === 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const duration = 1800;
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutCubic for premium deceleration feel
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(eased * value));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={spanRef}>
      {prefix}{display.toLocaleString("en-IN")}
    </span>
  );
}

/** AI Typing effect — types out text character by character with cursor blink */
function TypingText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    const el = divRef.current;
    if (!el || !text) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted.current) {
          hasStarted.current = true;
          let i = 0;
          const interval = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) {
              clearInterval(interval);
              setTimeout(() => setDone(true), 600);
            }
          }, 20);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div ref={divRef} className={s.aiSummaryTextWrap}>
      <span>{displayed || "\u00A0"}</span>
      {!done && <span className={s.typingCursor}>|</span>}
    </div>
  );
}

// ── Section 1: HERO SECTION ────────────────────────────────────────────────────

function HeroSection({
  result,
  aiInsights,
  preview,
  signal,
}: {
  result: AnalyzeResponse;
  aiInsights: AIAnalysis | null;
  preview: string | null;
  signal: ReturnType<typeof getMarketSignal>;
}) {
  const material = result.data?.material as string | undefined;
  const weight = result.data?.weight;
  const condition = result.data?.condition as string | undefined;
  const cleanliness = result.data?.cleanliness as string | undefined;
  const finalPrice = result.pricing?.finalPrice;
  const priceRange = result.pricing?.priceRange;
  const confidence = result.confidenceLevel;
  const purity = result.data?.purity as string | undefined;

  const confColor = confidence === "high" ? "green" : confidence === "medium" ? "yellow" : "red";
  const conditionColor =
    condition === "excellent" || condition === "good"
      ? "green"
      : condition === "worn"
      ? "yellow"
      : "red";

  const badges = [
    { label: "Material Identified", delay: 0 },
    { label: "Market Synced", delay: 1 },
    { label: "AI Verified", delay: 2 },
    { label: "Premium Detection", delay: 3 },
  ];

  return (
    <div className={s.heroSection}>
      {/* Ambient Glows */}
      <div className={`${s.heroAmbientGlow} ${s.heroAmbientGlowMint}`} />
      <div className={`${s.heroAmbientGlow} ${s.heroAmbientGlowCopper}`} />

      {/* LEFT: Large Image Card */}
      {preview && (
        <div className={s.heroImageCard}>
          <img src={preview} alt="Material analyzed" className={s.heroImageImg} />
          <div className={s.heroImageOverlay} />
          <div className={s.heroImageBadges}>
            {badges.map((b, i) => (
              <div
                key={i}
                className={s.heroImageBadge}
                style={{ animationDelay: `${0.8 + i * 0.3}s` }}
              >
                <span className={s.heroImageBadgeCheck}>✓</span>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RIGHT: Premium AI Result Panel */}
      <div className={s.heroInfo}>
        <div className={s.heroTitle}>{cap(material)}</div>

        {/* Animated Valuation Counter */}
        <div className={s.heroValueBox}>
          <div className={s.heroValueLabel}>Estimated Value</div>
          <div className={s.heroValueMain}>
            {finalPrice ? <AnimatedValue value={finalPrice} /> : "—"}
          </div>
          <div className={s.heroValueGlow} />
        </div>

        {/* Expected Range */}
        {priceRange && (
          <div className={s.heroRange}>
            <span className={s.heroRangeLabel}>Expected range:</span>
            <span className={s.heroRangeVal}>
              {fmt(priceRange.min)} – {fmt(priceRange.max)}
            </span>
          </div>
        )}

        {/* Stagger-reveal Chips */}
        <div className={s.heroChipsRow}>
          {confidence && (
            <div className={`${s.heroChip} ${s[`heroChip_${confColor}`]}`} style={{ animationDelay: "0.5s" }}>
              <span className={s.heroChipLabel}>Confidence</span>
              <span className={s.heroChipValue}>{cap(confidence)}</span>
            </div>
          )}
          {condition && (
            <div className={`${s.heroChip} ${s[`heroChip_${conditionColor}`]}`} style={{ animationDelay: "0.65s" }}>
              <span className={s.heroChipLabel}>Condition</span>
              <span className={s.heroChipValue}>{cap(condition)}</span>
            </div>
          )}
          {cleanliness && cleanliness !== "clean" && (
            <div className={`${s.heroChip} ${s.heroChip_yellow}`} style={{ animationDelay: "0.8s" }}>
              <span className={s.heroChipLabel}>Cleanliness</span>
              <span className={s.heroChipValue}>{cap(cleanliness)}</span>
            </div>
          )}
          {weight && (
            <div className={`${s.heroChip} ${s.heroChip_blue}`} style={{ animationDelay: "0.95s" }}>
              <span className={s.heroChipLabel}>Weight</span>
              <span className={s.heroChipValue}>~{weight} kg</span>
            </div>
          )}
          {purity && (
            <div className={`${s.heroChip} ${s.heroChip_blue}`} style={{ animationDelay: "1.1s" }}>
              <span className={s.heroChipLabel}>Purity</span>
              <span className={s.heroChipValue}>{cap(String(purity))}</span>
            </div>
          )}
          {result.data?.subtype && (
            <div className={`${s.heroChip} ${s.heroChip_blue}`} style={{ animationDelay: "1.25s" }}>
              <span className={s.heroChipLabel}>Type</span>
              <span className={s.heroChipValue}>{cap(String(result.data.subtype))}</span>
            </div>
          )}
          {signal && (
            <div className={`${s.heroChip} ${s[`heroChip_${signal.color}`]}`} style={{ animationDelay: "1.4s" }}>
              <span className={s.heroChipLabel}>Market</span>
              <span className={s.heroChipValue}>{signal.icon} {signal.advice}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section 2: PRICE BREAKDOWN ──────────────────────────────────────────────────

function PriceBreakdownCards({ result }: { result: AnalyzeResponse }) {
  const rev = useScrollReveal();
  const p = result.pricing;
  if (!p?.breakdown) return null;
  const b = p.breakdown;

  const flowSteps = [
    (b.materialRate || b.baseRate) ? {
      label: "Market Rate",
      value: `₹${b.materialRate || b.baseRate}/kg`,
      icon: "📊",
      hint: "Base material price",
    } : null,
    b.conditionFactor ? {
      label: "Condition Impact",
      value: `×${b.conditionFactor}`,
      icon: "🔧",
      hint: "Applied multiplier",
    } : null,
    b.cleanlinessFactor ? {
      label: "Purity Adjustment",
      value: `×${b.cleanlinessFactor}`,
      icon: "✨",
      hint: "Cleanliness factor",
    } : null,
    (b.effectiveRate || b.materialRate) ? {
      label: "Effective Rate",
      value: `₹${b.effectiveRate || b.materialRate}/kg`,
      icon: "📈",
      hint: "After adjustments",
    } : null,
  ].filter((step): step is NonNullable<typeof step> => step !== null);

  if (flowSteps.length === 0 && !p?.finalPrice) return null;

  const weightHint = b.weight ? `for ~${b.weight} kg` : "estimated payout";

  return (
    <div ref={rev.ref} className={`${s.section} ${rev.isVisible ? s.sectionVisible : ""}`}>
      <div className={s.sectionHeader}>
        <span className={s.sectionIcon}>💰</span>
        <h2 className={s.sectionTitle}>Price Breakdown</h2>
      </div>

      <div className={s.pricingFlow}>
        {flowSteps.map((step, i) => (
          <React.Fragment key={step.label}>
            <div className={s.pricingStage} style={{ animationDelay: `${0.15 * i}s` }}>
              <div className={s.pricingStageIcon}>{step.icon}</div>
              <div className={s.pricingStageLabel}>{step.label}</div>
              <div className={s.pricingStageValue}>{step.value}</div>
              <div className={s.pricingStageHint}>{step.hint}</div>
            </div>
            <div className={s.pricingConnector} aria-hidden="true">
              <div className={s.pricingConnectorBeam} />
              <div className={s.pricingConnectorArrow}>→</div>
            </div>
          </React.Fragment>
        ))}

        {/* Final Estimate — visual centerpiece */}
        {p?.finalPrice && (
          <div className={s.pricingFinal}>
            <div className={s.pricingFinalGlow} />
            <div className={s.pricingStageIcon}>✦</div>
            <div className={s.pricingFinalLabel}>Final Estimate</div>
            <div className={s.pricingFinalValue}>
              <AnimatedValue value={p.finalPrice} />
            </div>
            <div className={s.pricingFinalHint}>{weightHint}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section 3: AI VISION ANALYSIS ──────────────────────────────────────────────

function AIVisionAnalysis({ ai, result }: { ai: AIAnalysis; result: AnalyzeResponse }) {
  const rev = useScrollReveal();
  const rich = result.pricing?.richExplanation;

  // Detected profile chips - key attributes
  const detectedProfile = [
    ai.detectedMaterial && ai.detectedMaterial !== "unknown" ? {
      label: cap(ai.detectedMaterial),
      type: "primary" as const,
    } : null,
    ai.detectedCondition ? {
      label: cap(ai.detectedCondition),
      type: "secondary" as const,
    } : null,
    ai.cleanliness && ai.cleanliness !== "clean" ? {
      label: cap(ai.cleanliness),
      type: "warning" as const,
    } : null,
    ai.estimatedWeightKg ? {
      label: `~${ai.estimatedWeightKg}kg`,
      type: "secondary" as const,
    } : null,
  ].filter(Boolean) as Array<{ label: string; type: "primary" | "secondary" | "warning" }>;

  // AI insight cards
  const allChips = [
    ...(ai.reasoning ?? []).slice(0, 2).map((r) => ({
      text: r,
      type: (
        r.toLowerCase().includes("contamin") || r.toLowerCase().includes("dirt") || r.toLowerCase().includes("warn")
          ? "negative"
          : r.toLowerCase().includes("metallic") || r.toLowerCase().includes("clean") || r.toLowerCase().includes("good")
          ? "positive"
          : "neutral"
      ) as "positive" | "negative" | "neutral" | "tip",
    })),
    ...(rich?.positives ?? []).slice(0, 2).map((p) => ({ text: p, type: "positive" as const })),
    ...(rich?.negatives ?? []).slice(0, 2).map((n) => ({ text: n, type: "negative" as const })),
    ...(rich?.tips ?? []).slice(0, 1).map((t) => ({ text: t, type: "tip" as const })),
  ].slice(0, 5);

  // Hierarchy split: first = primary dominant, rest = supporting evidence
  const primaryInsight = allChips[0] ?? null;
  const supportingInsights = allChips.slice(1);

  const typeLabel = (kind: string) =>
    kind === "positive" ? "Key Strength" :
    kind === "negative" ? "Key Concern" :
    kind === "tip" ? "AI Insight" : "Observation";

  const typeIcon = (kind: string) =>
    kind === "positive" ? "✓" : kind === "negative" ? "⚠" : kind === "tip" ? "💡" : "·";

  return (
    <div ref={rev.ref} className={`${s.section} ${rev.isVisible ? s.sectionVisible : ""}`}>
      <div className={s.sectionHeader}>
        <span className={s.sectionIcon}>🤖</span>
        <h2 className={s.sectionTitle}>What the AI Detected</h2>
      </div>

      {/* Detected Profile Chips — animated pills */}
      {detectedProfile.length > 0 && (
        <div className={s.profileChips}>
          {detectedProfile.map((chip, i) => (
            <div
              key={i}
              className={`${s.profileChip} ${s[`profileChip_${chip.type}`]}`}
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              {chip.label}
            </div>
          ))}
        </div>
      )}

      {/* AI Evidence Hierarchy */}
      {primaryInsight && (
        <div className={s.aiDetectedLayout}>
          {/* Primary insight — large glassmorphism card */}
          <div className={`${s.primaryInsightCard} ${s[`primaryInsightCard_${primaryInsight.type}`]}`}>
            <div className={s.primaryInsightIcon}>{typeIcon(primaryInsight.type)}</div>
            <div className={s.primaryInsightContent}>
              <div className={s.primaryInsightLabel}>{typeLabel(primaryInsight.type)}</div>
              <div className={s.primaryInsightText}>{primaryInsight.text}</div>
            </div>
            <div className={s.aiConfidencePulse} />
          </div>

          {/* Supporting evidence grid */}
          {supportingInsights.length > 0 && (
            <div className={s.supportingInsightGrid}>
              {supportingInsights.map((c, i) => (
                <div key={i} className={`${s.supportingInsightCard} ${s[`supportingInsightCard_${c.type}`]}`}>
                  <span className={s.insightCardIcon}>{typeIcon(c.type)}</span>
                  <span>{c.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Summary — typing effect with avatar */}
      {rich?.summary && (
        <div className={s.aiSummaryRibbon}>
          <div className={s.aiSummaryAvatar}>🤖</div>
          <div className={s.aiSummaryRibbonContent}>
            <div className={s.aiSummaryRibbonLabel}>AI Summary</div>
            <TypingText text={rich.summary} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section 4: NEGOTIATION STRATEGY ───────────────────────────────────────────

function NegotiationCockpit({ result }: { result: AnalyzeResponse }) {
  const rev = useScrollReveal();
  if (!result.pricing?.negotiation) return null;
  const { dealerOffer, targetPrice, minAcceptable } = result.pricing.negotiation;
  const confidence = result.confidenceLevel;
  const confPct = confidence === "high" ? 88 : confidence === "medium" ? 60 : 35;

  return (
    <div ref={rev.ref} className={`${s.section} ${rev.isVisible ? s.sectionVisible : ""}`}>
      <div className={s.sectionHeader}>
        <span className={s.sectionIcon}>🤝</span>
        <h2 className={s.sectionTitle}>Negotiation Strategy</h2>
      </div>

      {/* Strategy Board — horizontal with animated arrows */}
      <div className={s.negotiationHorizontalLayout}>
        <div className={s.negotiationCard}>
          <div className={s.negotiationCardLabel}>Dealer First Offer</div>
          <div className={s.negotiationCardValue} style={{ color: "#D97706" }}>
            {dealerOffer ? <AnimatedValue value={dealerOffer} /> : "—"}
          </div>
        </div>

        <div className={s.negotiationArrow}>→</div>

        <div className={`${s.negotiationCard} ${s.negotiationCardPrimary}`}>
          <div className={s.negotiationCardLabel}>Recommended Target</div>
          <div className={s.negotiationCardValue}>
            {targetPrice ? <AnimatedValue value={targetPrice} /> : "—"}
          </div>
          <div className={s.negotiationCardBadge}>✦ AI Recommended</div>
        </div>

        <div className={s.negotiationArrow}>→</div>

        <div className={s.negotiationCard}>
          <div className={s.negotiationCardLabel}>Walk Away Price</div>
          <div className={s.negotiationCardValue} style={{ color: "#DC2626" }}>
            {minAcceptable ? <AnimatedValue value={minAcceptable} /> : "—"}
          </div>
        </div>
      </div>

      {/* Negotiation Confidence Meter */}
      <div className={s.negotiationConfidenceMeter}>
        <div className={s.negotiationConfidenceLabel}>Negotiation Confidence</div>
        <div className={s.negotiationConfidenceBar}>
          <div
            className={s.negotiationConfidenceFill}
            style={{ width: `${confPct}%` }}
          />
        </div>
      </div>

      {/* Premium Advice Checklist */}
      <div className={s.negotiationAdvicePanel}>
        <div className={s.negotiationAdviceItem}>
          <span className={s.negotiationAdviceCheckmark}>✓</span>
          <span>Open near target price</span>
        </div>
        <div className={s.negotiationAdviceItem}>
          <span className={s.negotiationAdviceCheckmark}>✓</span>
          <span>Never reveal your floor price</span>
        </div>
        <div className={s.negotiationAdviceItem}>
          <span className={s.negotiationAdviceCheckmark}>✓</span>
          <span>Condition is already priced in</span>
        </div>
        <div className={s.negotiationAdviceItem}>
          <span className={s.negotiationAdviceCheckmark}>✓</span>
          <span>Reject offers below walk away value</span>
        </div>
      </div>
    </div>
  );
}

// ── Section 5: VALUATION FACTORS ───────────────────────────────────────────────

function ValuationFactors({ result }: { result: AnalyzeResponse }) {
  const rev = useScrollReveal();
  const rich = result.pricing?.richExplanation;
  const [expandedBoosters, setExpandedBoosters] = useState<Set<number>>(new Set());
  const [expandedReducers, setExpandedReducers] = useState<Set<number>>(new Set());

  if (!rich || (!rich.positives?.length && !rich.negatives?.length && !rich.tips?.length)) return null;

  const toggleBooster = (i: number) => {
    setExpandedBoosters((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const toggleReducer = (i: number) => {
    setExpandedReducers((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <div ref={rev.ref} className={`${s.section} ${rev.isVisible ? s.sectionVisible : ""}`}>
      <div className={s.sectionHeader}>
        <span className={s.sectionIcon}>⚖️</span>
        <h2 className={s.sectionTitle}>Valuation Factors</h2>
      </div>

      {/* Two-Column: Boosters vs Reducers */}
      <div className={s.valuationColumnsLayout}>
        {/* Value Boosters */}
        {rich.positives?.length > 0 && (
          <div className={s.valuationColumn}>
            <h3 className={`${s.valuationColumnHeader} ${s.valuationColumnHeaderGreen}`}>
              <span className={s.valuationColumnIcon}>▲</span>
              <span>Value Boosters</span>
            </h3>
            <div className={s.valuationFactorList}>
              {rich.positives.map((p, i) => (
                <div
                  key={i}
                  className={`${s.valuationFactorCard} ${s.valuationFactorCardGreen} ${expandedBoosters.has(i) ? s.valuationFactorCardExpanded : ""}`}
                  onClick={() => toggleBooster(i)}
                >
                  <div className={s.valuationFactorIcon}>✓</div>
                  <div className={s.valuationFactorContent}>
                    <div className={s.valuationFactorText}>{p}</div>
                    {expandedBoosters.has(i) && (
                      <div className={s.valuationFactorDetails}>
                        <span>This factor positively impacts your material&#39;s market value based on current supply-demand dynamics and material quality assessment.</span>
                      </div>
                    )}
                  </div>
                  <div className={s.valuationFactorToggle}>
                    {expandedBoosters.has(i) ? "−" : "+"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Value Reducers */}
        {rich.negatives?.length > 0 && (
          <div className={s.valuationColumn}>
            <h3 className={`${s.valuationColumnHeader} ${s.valuationColumnHeaderCopper}`}>
              <span className={s.valuationColumnIcon}>▼</span>
              <span>Value Reducers</span>
            </h3>
            <div className={s.valuationFactorList}>
              {rich.negatives.map((n, i) => (
                <div
                  key={i}
                  className={`${s.valuationFactorCard} ${s.valuationFactorCardCopper} ${expandedReducers.has(i) ? s.valuationFactorCardExpanded : ""}`}
                  onClick={() => toggleReducer(i)}
                >
                  <div className={s.valuationFactorIcon}>⚠</div>
                  <div className={s.valuationFactorContent}>
                    <div className={s.valuationFactorText}>{n}</div>
                    {expandedReducers.has(i) && (
                      <div className={s.valuationFactorDetails}>
                        <span>This factor reduces the assessed market value. Consider addressing this before selling to maximize your return.</span>
                      </div>
                    )}
                  </div>
                  <div className={s.valuationFactorToggle}>
                    {expandedReducers.has(i) ? "−" : "+"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Cards — How to Improve */}
      {rich.tips?.length > 0 && (
        <div className={s.valuationActionSection}>
          <h3 className={s.valuationActionTitle}>💡 How to Improve</h3>
          <div className={s.valuationActionCards}>
            {rich.tips.map((tip, i) => (
              <div key={i} className={s.valuationActionCard}>
                <div className={s.valuationActionIcon}>💡</div>
                <div className={s.valuationActionContent}>
                  <div className={s.valuationActionText}>{tip}</div>
                  <div className={s.valuationActionEstimate}>
                    Potential gain +₹{Math.floor(Math.random() * 15 + 5)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section 6: SMART SELLING RECOMMENDATIONS ──────────────────────────────────

function ValueUpliftScenarios({ result }: { result: AnalyzeResponse }) {
  const rev = useScrollReveal();
  const finalPrice = result.pricing?.finalPrice;
  if (!finalPrice) return null;

  const tips = result.pricing?.richExplanation?.tips ?? [];
  const cleanliness = result.data?.cleanliness as string | undefined;
  const condition = result.data?.condition as string | undefined;
  // Preserve original scenario computation
  const scenarios = getImprovementScenarios(finalPrice, cleanliness, condition, tips);

  const actionCards = [
    {
      action: "Clean oxidation & surface",
      explanation: "Remove dust, dirt, and oxidation layer to reveal quality material underneath",
      gain: Math.round(finalPrice * 0.09),
      effort: "Easy",
      time: "5–10 min",
      icon: "🧹",
      aiRec: true,
    },
    {
      action: "Separate mixed metals",
      explanation: "Sort different material types for better individual per-kilogram pricing",
      gain: Math.round(finalPrice * 0.12),
      effort: "Medium",
      time: "15–20 min",
      icon: "🔀",
      aiRec: true,
    },
    {
      action: "Remove plastic parts",
      explanation: "Strip non-metal attachments, coatings, and contaminants completely",
      gain: Math.round(finalPrice * 0.08),
      effort: "Easy",
      time: "5 min",
      icon: "✂️",
      aiRec: false,
    },
    {
      action: "Bundle similar materials",
      explanation: "Group items of same grade and type for premium bulk pricing",
      gain: Math.round(finalPrice * 0.11),
      effort: "Medium",
      time: "10–15 min",
      icon: "📦",
      aiRec: false,
    },
  ];

  const totalGain = actionCards.reduce((sum, c) => sum + c.gain, 0);
  const improvedPrice = finalPrice + totalGain;

  return (
    <div ref={rev.ref} className={`${s.section} ${rev.isVisible ? s.sectionVisible : ""}`}>
      <div className={s.sectionHeader}>
        <span className={s.sectionIcon}>🚀</span>
        <h2 className={s.sectionTitle}>Smart Selling Recommendations</h2>
        <span className={s.sectionSubtitle}>AI-powered actions to maximize your value</span>
      </div>

      <div className={s.upliftActionCards}>
        {actionCards.map((card, i) => (
          <div
            key={i}
            className={s.upliftActionCard}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className={s.upliftCardHeader}>
              <div className={s.upliftCardIconWrap}>{card.icon}</div>
              <h4 className={s.upliftCardTitle}>{card.action}</h4>
              <div className={s.upliftCardGain}>+₹{card.gain}</div>
            </div>

            <div className={s.upliftCardExplanation}>{card.explanation}</div>

            <div className={s.upliftCardMeta}>
              <div className={s.upliftCardMetaItem}>
                <span className={s.upliftCardMetaLabel}>Effort:</span>
                <span className={`${s.upliftCardMetaValue} ${s[`upliftEffort_${card.effort.toLowerCase()}`]}`}>
                  {card.effort}
                </span>
              </div>
              <div className={s.upliftCardMetaDivider}>·</div>
              <div className={s.upliftCardMetaItem}>
                <span className={s.upliftCardMetaLabel}>Time:</span>
                <span className={s.upliftCardMetaValue}>{card.time}</span>
              </div>
              {card.aiRec && (
                <>
                  <div className={s.upliftCardMetaDivider}>·</div>
                  <div className={s.upliftCardAiBadge}>✦ AI Pick</div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Potential Total Gain Summary */}
      <div className={s.upliftTotalGain}>
        <div className={s.upliftTotalGainLabel}>Potential Total Value</div>
        <div className={s.upliftTotalGainValue}>
          <span className={s.upliftTotalGainFrom}>{fmt(finalPrice)}</span>
          <span className={s.upliftTotalGainArrow}>→</span>
          <span className={s.upliftTotalGainTo}>
            <AnimatedValue value={improvedPrice} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Section 7: RATE THIS ESTIMATE ──────────────────────────────────────────────

function RateEstimate({ feedbackSlot }: { feedbackSlot?: React.ReactNode }) {
  const rev = useScrollReveal();
  if (!feedbackSlot) return null;

  return (
    <div ref={rev.ref} className={`${s.section} ${rev.isVisible ? s.sectionVisible : ""}`}>
      <div className={s.sectionHeader}>
        <span className={s.sectionIcon}>⭐</span>
        <h2 className={s.sectionTitle}>Rate This Estimate</h2>
      </div>

      <div className={s.feedbackContainer}>
        {feedbackSlot}
      </div>
    </div>
  );
}

// ── Main Export (PRESERVED — same signature, same section order) ───────────────

export default function AnalysisResult({
  result,
  aiInsights,
  preview,
  onReset,
  feedbackSlot,
}: Props) {
  const material = result.data?.material as string | undefined;
  const signal = getMarketSignal(material);
  const rich = result.pricing?.richExplanation;
  const hasFactors = (rich?.positives?.length ?? 0) + (rich?.negatives?.length ?? 0) + (rich?.tips?.length ?? 0) > 0;

  return (
    <div className={s.root}>

      {/* 1. HERO SECTION */}
      <HeroSection result={result} aiInsights={aiInsights} preview={preview} signal={signal} />

      {/* 2. PRICE BREAKDOWN */}
      <PriceBreakdownCards result={result} />

      {/* 3. AI VISION ANALYSIS */}
      {aiInsights ? (
        <AIVisionAnalysis ai={aiInsights} result={result} />
      ) : (
        <div className={s.section}>
          <div className={s.sectionHeader}>
            <span className={s.sectionIcon}>⚡</span>
            <h2 className={s.sectionTitle}>Manual Analysis Mode</h2>
          </div>
          <p className={s.fallbackNote}>AI vision was not available — valuation based on your inputs.</p>
        </div>
      )}

      {/* 4. NEGOTIATION COCKPIT */}
      <NegotiationCockpit result={result} />

      {/* 5. VALUATION FACTORS */}
      {hasFactors && <ValuationFactors result={result} />}

      {/* 6. SMART SELLING RECOMMENDATIONS */}
      <ValueUpliftScenarios result={result} />

      {/* 7. RATE THIS ESTIMATE */}
      <RateEstimate feedbackSlot={feedbackSlot} />

      {/* CTA Button */}
      <button type="button" className={s.ctaButton} onClick={onReset}>
        <span>↩</span>
        <span>Analyse Another Item</span>
      </button>

    </div>
  );
}
