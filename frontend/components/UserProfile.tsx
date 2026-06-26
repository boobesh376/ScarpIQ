"use client";

import { useAuth } from "../lib/authService";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";

export function UserProfile() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [hoverLogout, setHoverLogout] = useState(false);
  const [hoverAvatar, setHoverAvatar] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Smooth open/close with animation state
  const openDropdown = useCallback(() => {
    setIsOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
  }, []);

  const closeDropdown = useCallback(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsOpen(false), 200);
    return () => clearTimeout(timer);
  }, []);

  const toggleDropdown = useCallback(() => {
    if (isOpen) closeDropdown();
    else openDropdown();
  }, [isOpen, openDropdown, closeDropdown]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeDropdown]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdown();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, closeDropdown]);

  if (loading || !user) {
    return null;
  }

  const userEmail = user.email || "User";
  const userInitial = userEmail.charAt(0).toUpperCase();
  const userName = userEmail.split("@")[0];
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    closeDropdown();
    router.push("/login");
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Avatar trigger button */}
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        onMouseEnter={() => setHoverAvatar(true)}
        onMouseLeave={() => setHoverAvatar(false)}
        title={userEmail}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "5px 12px 5px 5px",
          background: isOpen
            ? "rgba(16,185,129,0.08)"
            : hoverAvatar
              ? "rgba(16,185,129,0.04)"
              : "transparent",
          border: `1.5px solid ${isOpen ? "rgba(16,185,129,0.25)" : hoverAvatar ? "rgba(16,185,129,0.12)" : "transparent"}`,
          borderRadius: "999px",
          cursor: "pointer",
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          minHeight: "auto",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 700,
            fontSize: "14px",
            flexShrink: 0,
            boxShadow: hoverAvatar || isOpen
              ? "0 4px 16px rgba(16,185,129,0.35), 0 0 0 3px rgba(16,185,129,0.1)"
              : "0 2px 8px rgba(16,185,129,0.2)",
            transition: "box-shadow 0.3s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
            transform: hoverAvatar && !isOpen ? "scale(1.05)" : "scale(1)",
          }}
        >
          {userInitial}
        </div>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#374151",
            maxWidth: "120px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "none",
          }}
          className="user-email-label"
        >
          {displayName}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{
            flexShrink: 0,
            transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            display: "none",
          }}
          className="user-chevron"
        >
          <path d="M3 4.5l3 3 3-3" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Premium dropdown — user-focused only */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            minWidth: "280px",
            background: "rgba(255,255,255,0.78)",
            backdropFilter: "blur(28px) saturate(190%)",
            WebkitBackdropFilter: "blur(28px) saturate(190%)",
            border: "1px solid rgba(255,255,255,0.5)",
            borderRadius: "22px",
            overflow: "hidden",
            boxShadow:
              "0 28px 60px rgba(15,23,42,0.14), 0 10px 22px rgba(15,23,42,0.06), 0 0 0 1px rgba(16,185,129,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
            zIndex: 1000,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)",
            transition: "opacity 0.22s cubic-bezier(0.16,1,0.3,1), transform 0.22s cubic-bezier(0.16,1,0.3,1)",
            transformOrigin: "top right",
          }}
        >
          {/* Ambient gradient wash */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 100% 0%, rgba(16,185,129,0.10) 0%, transparent 55%), radial-gradient(circle at 0% 100%, rgba(109,40,217,0.06) 0%, transparent 55%)",
            pointerEvents: "none",
          }} />

          {/* User info — generous spacing, centered focus */}
          <div style={{
            position: "relative",
            padding: "30px 24px 26px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}>
            {/* Large avatar */}
            <div style={{
              position: "relative",
              width: "76px", height: "76px",
              marginBottom: "16px",
            }}>
              <div style={{
                width: "76px", height: "76px", borderRadius: "26px",
                background: "linear-gradient(135deg, #34D399 0%, #059669 55%, #047857 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 800, fontSize: "28px",
                letterSpacing: "-0.02em",
                boxShadow: "0 10px 28px rgba(5,150,105,0.32), 0 2px 8px rgba(5,150,105,0.18), inset 0 1px 0 rgba(255,255,255,0.25)",
              }}>
                {userInitial}
              </div>
              {/* Online indicator badge on avatar */}
              <span style={{
                position: "absolute", bottom: "-3px", right: "-3px",
                width: "20px", height: "20px", borderRadius: "50%",
                background: "#10B981",
                border: "3px solid rgba(255,255,255,0.92)",
                boxShadow: "0 0 0 2px rgba(16,185,129,0.18), 0 2px 6px rgba(16,185,129,0.4)",
              }} />
            </div>

            <div style={{
              fontSize: "16.5px", fontWeight: 800, color: "#0F172A",
              letterSpacing: "-0.015em", marginBottom: "5px",
              maxWidth: "230px", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {displayName}
            </div>
            <div style={{
              fontSize: "13px", color: "#64748B", fontWeight: 500,
              marginBottom: "14px",
              maxWidth: "230px", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {userEmail}
            </div>

            {/* Online status pill */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "5px 13px", borderRadius: "999px",
              background: "rgba(16,185,129,0.10)",
              border: "1px solid rgba(16,185,129,0.18)",
            }}>
              <span style={{
                width: "7px", height: "7px", borderRadius: "50%",
                background: "#10B981",
                boxShadow: "0 0 7px rgba(16,185,129,0.6)",
              }} />
              <span style={{
                fontSize: "11px", fontWeight: 700, color: "#059669",
                letterSpacing: "0.03em",
              }}>
                Online
              </span>
            </div>
          </div>

          {/* Divider */}
          <div style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(15,23,42,0.09) 20%, rgba(15,23,42,0.09) 80%, transparent)",
            margin: "0 22px",
          }} />

          {/* Sign out */}
          <div style={{ padding: "14px" }}>
            <div
              onClick={handleLogout}
              onMouseEnter={() => setHoverLogout(true)}
              onMouseLeave={() => setHoverLogout(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                padding: "13px 16px",
                fontSize: "13.5px",
                fontWeight: 700,
                cursor: "pointer",
                color: hoverLogout ? "#DC2626" : "#475569",
                background: hoverLogout ? "rgba(239,68,68,0.07)" : "rgba(15,23,42,0.03)",
                border: `1px solid ${hoverLogout ? "rgba(239,68,68,0.18)" : "rgba(15,23,42,0.06)"}`,
                borderRadius: "14px",
                transition: "all 0.2s ease",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H3.5A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14H6M10.5 11l3-3-3-3M13.5 8h-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 1024px) {
          .user-email-label, .user-chevron { display: inline-flex !important; }
        }
      `}</style>
    </div>
  );
}