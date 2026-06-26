"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./Landing.module.css";

const NAV_LINKS = [
  { label: "Features",     href: "#features"      },
  { label: "How It Works", href: "#how-it-works"   },
  { label: "Intelligence", href: "#intelligence"   },
  { label: "Community",    href: "#community"      },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <nav
        ref={navRef}
        style={{
          position: "fixed",
          top: scrolled ? "12px" : "0",
          left: scrolled ? "50%" : "0",
          right: scrolled ? "auto" : "0",
          transform: scrolled ? "translateX(-50%)" : "none",
          width: scrolled ? "min(1100px, calc(100vw - 48px))" : "100%",
          zIndex: 1000,
          transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
          background: scrolled
            ? "rgba(255,255,255,0.85)"
            : "rgba(255,255,255,0)",
          backdropFilter: scrolled ? "blur(24px) saturate(180%)" : "none",
          borderRadius: scrolled ? "16px" : "0",
          border: scrolled ? "1px solid #E2E8F0" : "1px solid transparent",
          boxShadow: scrolled ? "0 8px 32px rgba(15,23,42,0.08)" : "none",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: scrolled ? "12px 24px" : "20px 40px",
          transition: "padding 0.4s cubic-bezier(0.4,0,0.2,1)",
          maxWidth: "100%",
        }}>
          {/* Logo */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <div style={{
              width: "32px", height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #00C896, #5EEAD4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "16px",
            }}>♻</div>
            <span style={{
              fontSize: "18px",
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: "-0.03em",
            }}>ScrapIQ</span>
          </Link>

          {/* Desktop nav links */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }} className="desktop-nav">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#475569",
                  fontSize: "14px",
                  fontWeight: 500,
                  padding: "8px 16px",
                  cursor: "pointer",
                  borderRadius: "8px",
                  transition: "color 0.2s, background 0.2s",
                  whiteSpace: "nowrap",
                  minHeight: "auto",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#0F172A";
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,200,150,0.06)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#475569";
                  (e.currentTarget as HTMLButtonElement).style.background = "none";
                }}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* CTA buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }} className="desktop-nav">
            <Link
              href="/login"
              style={{
                color: "#475569",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                transition: "color 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = "#0F172A"}
              onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = "#475569"}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className={styles.btnPrimary}
              style={{ padding: "9px 20px", fontSize: "14px" }}
            >
              Get Started →
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(v => !v)}
            style={{
              display: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              color: "#0F172A",
              borderRadius: "8px",
            }}
            aria-label="Toggle menu"
            className="mobile-nav"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              {mobileOpen ? (
                <>
                  <path d="M5 5L17 17M5 17L17 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </>
              ) : (
                <>
                  <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div style={{
            padding: "12px 24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            borderTop: "1px solid #E2E8F0",
          }}>
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#475569",
                  fontSize: "15px",
                  fontWeight: 500,
                  padding: "12px 8px",
                  cursor: "pointer",
                  textAlign: "left",
                  borderRadius: "8px",
                  minHeight: "auto",
                }}
              >
                {link.label}
              </button>
            ))}
            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "12px",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  color: "#0F172A",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "12px",
                  background: "#00C896",
                  borderRadius: "10px",
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Responsive style for desktop/mobile nav items */}
      <style>{`
        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
          .desktop-nav { display: flex !important; }
        }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-nav { display: flex !important; }
        }
      `}</style>
    </>
  );
}
