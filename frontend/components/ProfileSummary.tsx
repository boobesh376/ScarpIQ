"use client";

import { getUserInitials, formatJoinedDate } from "@/lib/dashboardHelpers";
import type { User } from "@supabase/supabase-js";

interface ProfileSummaryProps {
  user: User | null;
  totalAnalyses: number;
}

export function ProfileSummary({ user, totalAnalyses }: ProfileSummaryProps) {
  const cardStyle: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "20px",
    padding: "24px",
    textAlign: "center",
    boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
  };

  if (!user) {
    return (
      <div style={cardStyle}>
        <p style={{ color: "#94A3B8", fontSize: "13.5px" }}>Loading profile...</p>
      </div>
    );
  }

  const metadata = user.user_metadata as Record<string, any> | undefined;
  const firstName = metadata?.first_name || user.email?.split("@")[0] || "User";
  const lastName = metadata?.last_name || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const initials = getUserInitials(firstName, lastName);
  const joinedDate = formatJoinedDate(user.created_at || new Date().toISOString());

  return (
    <div style={cardStyle}>
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%",
        background: "linear-gradient(135deg, #00C896 0%, #00B383 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "22px", fontWeight: 800, color: "#fff",
        margin: "0 auto 14px",
        boxShadow: "0 8px 20px rgba(0,200,150,0.25)",
      }}>
        {initials}
      </div>
      <div style={{ fontSize: "17px", fontWeight: 800, color: "#0F172A", marginBottom: "3px" }}>{fullName}</div>
      <div style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px", wordBreak: "break-all" }}>
        {user.email}
      </div>

      <div style={{ height: "1px", background: "#F1F5F9", margin: "0 0 16px" }} />

      <div style={{ display: "flex", justifyContent: "space-around" }}>
        <div>
          <div style={{ fontSize: "19px", fontWeight: 800, color: "#00B383" }}>{totalAnalyses}</div>
          <div style={{ fontSize: "10.5px", color: "#94A3B8", marginTop: "2px" }}>Analyses</div>
        </div>
        <div>
          <div style={{ fontSize: "19px", fontWeight: 800, color: "#FFB800" }}>⭐</div>
          <div style={{ fontSize: "10.5px", color: "#94A3B8", marginTop: "2px" }}>Member</div>
        </div>
      </div>

      <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "14px" }}>Joined {joinedDate}</div>
    </div>
  );
}
