"use client";

import { useState, useEffect } from "react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

// ── Sidebar width constants — shared between AppShell and Sidebar ───────────
export const SIDEBAR_W = 256;
export const SIDEBAR_W_COLLAPSED = 84;
export const SIDEBAR_GAP = 14; // left offset of the floating sidebar + breathing room before content
export const NAVBAR_H = 72;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Detect mobile on mount and on resize
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setIsMobile(mq.matches);
      // Auto-close sidebar when going to desktop
      if (!mq.matches) setSidebarOpen(false);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMobile, sidebarOpen]);

  const effectiveWidth = isMobile
    ? 0
    : (collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W) + SIDEBAR_GAP * 2;

  return (
    <div style={{
      display: "flex", flexDirection: "column", minHeight: "100vh",
      background: "#F8FAF8",
      backgroundImage: "radial-gradient(circle at 15% 0%, rgba(16,185,129,0.04) 0%, transparent 45%), radial-gradient(circle at 85% 15%, rgba(16,185,129,0.02) 0%, transparent 40%)",
      position: "relative",
    }}>
      <Navbar
        onMenuToggle={() => setSidebarOpen((v) => !v)}
        isMobile={isMobile}
      />

      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar
          isOpen={sidebarOpen}
          isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
        />

        {/* Overlay backdrop for mobile sidebar */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 89,
              backdropFilter: "blur(2px)",
            }}
          />
        )}

        <main
          style={{
            flex: 1,
            marginLeft: `${effectiveWidth}px`,
            padding: isMobile ? "16px 12px 40px" : "24px",
            overflowX: "hidden",
            minWidth: 0,
            transition: "margin-left 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
