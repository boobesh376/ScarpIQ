"use client";

import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { TrustMetrics } from "./TrustMetrics";
import { HowItWorks } from "./HowItWorks";
import { InteractiveDemo } from "./InteractiveDemo";
import { FeaturesGrid } from "./FeaturesGrid";
import { MarketIntelligence } from "./MarketIntelligence";
import { SustainabilitySection } from "./SustainabilitySection";
import { Testimonials } from "./Testimonials";
import { FaqSection } from "./FaqSection";
import { FinalCta } from "./FinalCta";
import { LandingFooter } from "./LandingFooter";
import { MarketTicker } from "@/components/shared/MarketTicker";
import styles from "./Landing.module.css";

export function LandingPage() {
  return (
    <div className={styles.root}>
      <LandingNav />
      <main>
        <HeroSection />
        <MarketTicker />
        <TrustMetrics />
        <HowItWorks />
        <InteractiveDemo />
        <FeaturesGrid />
        <MarketIntelligence />
        <SustainabilitySection />
        <Testimonials />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
