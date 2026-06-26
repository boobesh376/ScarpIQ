"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SIDEBAR_W, SIDEBAR_W_COLLAPSED, SIDEBAR_GAP, NAVBAR_H } from "./AppShell";

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

interface NavItem {
  icon: string;
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: "📊", label: "Dashboard", href: "/dashboard" },
  { icon: "📤", label: "Analyze",   href: "/upload"    },
  { icon: "📜", label: "History",   href: "/history"   },
  { icon: "💰", label: "Prices",    href: "/prices"    },
  { icon: "👥", label: "Community", href: "/community" },
];

export function Sidebar({ isOpen, isMobile, onClose, collapsed, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  const navRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  const showLabels = !collapsed || isMobile;
  const width = isMobile ? SIDEBAR_W : collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W;

  // Track the active item's position to animate a sliding indicator pill behind it.
  // Uses a data-attribute + querySelector lookup (not a ref passed to next/link,
  // which has had ref-forwarding issues on React 19) for measuring layout position.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeHref = NAV_ITEMS.find((item) => isActive(item.href))?.href;
    const el = activeHref
      ? (nav.querySelector(`[data-nav-href="${activeHref}"]`) as HTMLElement | null)
      : null;
    if (el) {
      const navRect = nav.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicator({ top: elRect.top - navRect.top, height: elRect.height });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, collapsed, isMobile]);

  const sidebarStyle: React.CSSProperties = {
    width: `${width}px`,
    position: "fixed",
    left: isMobile ? "12px" : `${SIDEBAR_GAP}px`,
    top: `${NAVBAR_H + SIDEBAR_GAP}px`,
    bottom: `${SIDEBAR_GAP}px`,
    zIndex: 90,
    display: "flex",
    flexDirection: "column",
    borderRadius: "20px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(240,255,246,0.65) 100%)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(16,185,129,0.1)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.04), inset 0 1px 0 rgba(16,185,129,0.1)",
    padding: "18px 12px",
    transition: "width 0.3s cubic-bezier(0.4,0,0.2,1), transform 0.3s cubic-bezier(0.4,0,0.2,1)",
    transform: isMobile && !isOpen ? `translateX(-${SIDEBAR_W + 30}px)` : "translateX(0)",
    overflow: "hidden",
  };

  return (
    <aside style={sidebarStyle}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: "-40px", left: "-40px",
        width: "140px", height: "140px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: "#64748B",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: "14px",
          paddingLeft: showLabels ? "12px" : "0",
          textAlign: showLabels ? "left" : "center",
          height: "14px",
          opacity: showLabels ? 1 : 0,
          transition: "opacity 0.2s ease",
          whiteSpace: "nowrap",
          position: "relative",
        }}
      >
        Navigation
      </div>

      <nav ref={navRef} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "4px" }}>
        {/* Sliding active indicator */}
        {indicator && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${indicator.top}px`,
              height: `${indicator.height}px`,
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(52,211,153,0.08))",
              border: "1px solid rgba(16,185,129,0.2)",
              boxShadow: "0 0 0 1px rgba(16,185,129,0.05), 0 4px 12px rgba(16,185,129,0.08)",
              transition: "top 0.35s cubic-bezier(0.4,0,0.2,1), height 0.35s cubic-bezier(0.4,0,0.2,1)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}

        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <SidebarLink
              key={item.href}
              item={item}
              active={active}
              showLabel={showLabels}
              onClick={isMobile ? onClose : undefined}
            />
          );
        })}
      </nav>

      {/* Today's Best Material Card */}
      {showLabels && (
        <div style={{
          marginTop: "20px",
          padding: "12px",
          borderRadius: "14px",
          background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(52,211,153,0.04))",
          border: "1px solid rgba(16,185,129,0.15)",
          boxShadow: "0 4px 12px rgba(16,185,129,0.06)",
        }}>
          <div style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "#64748B",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "10px",
          }}>
            Today's Best Material
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "10px",
            borderBottom: "1px solid rgba(16,185,129,0.1)",
            marginBottom: "10px",
          }}>
            <span style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#1F2937",
            }}>
              Copper
            </span>
            <span style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#1F2937",
            }}>
              ₹720/kg
            </span>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#10B981",
          }}>
            <span>↑</span>
            <span>2.5% today</span>
          </div>
        </div>
      )}

      {/* Collapse toggle (desktop only) */}
      {!isMobile && (
        <button
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: "10px",
            padding: collapsed ? "10px" : "10px 12px",
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            color: "#64748B",
            fontSize: "12.5px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
            minHeight: "auto",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#EEF7F1";
            e.currentTarget.style.color = "#10B981";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#FFFFFF";
            e.currentTarget.style.color = "#64748B";
          }}
        >
          <span style={{
            display: "inline-flex",
            transition: "transform 0.3s ease",
            transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
            fontSize: "14px",
          }}>
            ◀
          </span>
          {showLabels && <span>Collapse</span>}
        </button>
      )}
    </aside>
  );
}

function SidebarLink({
  item,
  active,
  showLabel,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  showLabel: boolean;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={item.href}
      data-nav-href={item.href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={!showLabel ? item.label : undefined}
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: showLabel ? "11px 12px" : "11px",
        justifyContent: showLabel ? "flex-start" : "center",
        color: active ? "#10B981" : hovered ? "#1F2937" : "#64748B",
        textDecoration: "none",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: active ? 700 : 500,
        transition: "color 0.2s ease, background 0.2s ease, transform 0.2s ease",
        background: !active && hovered ? "#EEF7F1" : "transparent",
        transform: hovered ? "translateX(4px)" : "translateX(0)",
      }}
    >
      <span
        style={{
          fontSize: "18px",
          minWidth: "20px",
          textAlign: "center",
          display: "inline-block",
          transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), filter 0.2s ease",
          transform: hovered ? "scale(1.15) translateY(-1px)" : "scale(1)",
          filter: active ? "drop-shadow(0 0 4px rgba(16,185,129,0.4))" : "none",
        }}
      >
        {item.icon}
      </span>
      {showLabel && (
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.label}
        </span>
      )}
      {showLabel && active && (
        <span style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: "#10B981",
          boxShadow: "0 0 8px rgba(16,185,129,0.6)",
          flexShrink: 0,
        }} />
      )}
    </Link>
  );
}
