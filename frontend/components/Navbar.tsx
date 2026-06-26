"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserProfile } from "./UserProfile";
import { NAVBAR_H } from "./AppShell";

interface NavbarProps {
  onMenuToggle?: () => void;
  isMobile?: boolean;
}

export function Navbar({ onMenuToggle, isMobile }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      style={{
        background: scrolled ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.78)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: scrolled ? "1px solid rgba(16,185,129,0.12)" : "1px solid rgba(16,185,129,0.06)",
        boxShadow: scrolled
          ? "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)"
          : "0 2px 8px rgba(0,0,0,0.02)",
        padding: "0 28px",
        height: `${NAVBAR_H}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky" as const,
        top: 0,
        zIndex: 100,
        transition: "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
        margin: "16px 16px 0 16px",
        borderRadius: "20px",
      }}
    >
      {/* Left: hamburger (mobile) + logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {isMobile && (
          <button
            onClick={onMenuToggle}
            aria-label="Toggle navigation menu"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              cursor: "pointer",
              color: "#1F2937",
              width: "38px",
              height: "38px",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              lineHeight: 1,
              transition: "all 0.2s ease",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            ☰
          </button>
        )}

        <Link
          href="/dashboard"
          style={{
            fontSize: "19px",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "#0F172A",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            transition: "opacity 0.2s ease",
          }}
        >
          <span style={{
            width: "32px", height: "32px", borderRadius: "10px",
            background: "linear-gradient(135deg, #10B981, #059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "15px", flexShrink: 0,
            boxShadow: "0 2px 8px rgba(16,185,129,0.3)",
          }}>
            ♻
          </span>
          <span>ScrapIQ</span>
        </Link>
      </div>

      {/* Right: profile only — clean and minimal */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <UserProfile />
      </div>
    </nav>
  );
}
