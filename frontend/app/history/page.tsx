"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchHistory,
  submitFeedback,
  type AnalysisRecord,
} from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function capitalize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");
}

function materialEmoji(material: string | null): string {
  switch (material?.toLowerCase()) {
    case "copper":    return "🟤";
    case "aluminum":  return "⚪";
    case "iron":      return "⚙️";
    case "steel":     return "🔩";
    case "plastic":   return "♻️";
    default:          return "📦";
  }
}

function confidenceColor(level: string | null): string {
  switch (level?.toLowerCase()) {
    case "high":   return "#36d6b6";
    case "medium": return "#f5a623";
    case "low":    return "#ff5a65";
    default:       return "#9498b5";
  }
}

// ─── Feedback Widget ──────────────────────────────────────────────────────────

interface FeedbackWidgetProps {
  analysisId: string;
}

function FeedbackWidget({ analysisId }: FeedbackWidgetProps) {
  const [voted, setVoted]       = useState<boolean | null>(null);
  const [note, setNote]         = useState("");
  const [showNote, setShowNote] = useState(false);
  const [sending, setSending]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  async function sendFeedback(isAccurate: boolean) {
    setSending(true);
    setError("");
    try {
      await submitFeedback({
        analysis_id: analysisId,
        is_accurate: isAccurate,
        note: note.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send feedback");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <p style={{ color: "var(--success)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
        ✓ Thank you for your feedback!
      </p>
    );
  }

  return (
    <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
        Was this estimate accurate?
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => { setVoted(true); setShowNote(true); }}
          disabled={sending}
          style={{
            padding: "0.3rem 0.9rem",
            borderRadius: "var(--radius-full)",
            border: `1px solid ${voted === true ? "var(--success)" : "var(--border-default)"}`,
            background: voted === true ? "rgba(54,214,182,0.1)" : "transparent",
            color: voted === true ? "var(--success)" : "var(--text-secondary)",
            cursor: "pointer",
            fontSize: "0.8rem",
            transition: "all 0.2s",
          }}
        >
          👍 Accurate
        </button>
        <button
          onClick={() => { setVoted(false); setShowNote(true); }}
          disabled={sending}
          style={{
            padding: "0.3rem 0.9rem",
            borderRadius: "var(--radius-full)",
            border: `1px solid ${voted === false ? "var(--error)" : "var(--border-default)"}`,
            background: voted === false ? "rgba(255,90,101,0.08)" : "transparent",
            color: voted === false ? "var(--error)" : "var(--text-secondary)",
            cursor: "pointer",
            fontSize: "0.8rem",
            transition: "all 0.2s",
          }}
        >
          👎 Not accurate
        </button>
      </div>

      {showNote && voted !== null && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <input
            type="text"
            placeholder="Optional note (e.g. actual price)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{
              flex: 1,
              padding: "0.35rem 0.65rem",
              background: "var(--bg-input)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontSize: "0.8rem",
            }}
          />
          <button
            onClick={() => sendFeedback(voted!)}
            disabled={sending}
            style={{
              padding: "0.35rem 0.85rem",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      )}

      {error && (
        <p style={{ color: "var(--error)", fontSize: "0.75rem", marginTop: "0.35rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── History Row ──────────────────────────────────────────────────────────────

interface HistoryRowProps {
  record: AnalysisRecord;
}

function HistoryRow({ record }: HistoryRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
    >
      <button
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "1rem 1.25rem",
          display: "grid",
          gridTemplateColumns: "2rem 1fr auto auto",
          alignItems: "center",
          gap: "0.75rem",
          textAlign: "left",
          color: "var(--text-primary)",
        }}
      >
        <span style={{ fontSize: "1.4rem" }}>
          {materialEmoji(record.material)}
        </span>

        <div>
          <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
            {capitalize(record.material)}
            {record.category && (
              <span style={{ fontWeight: 400, color: "var(--text-secondary)", marginLeft: "0.4rem", fontSize: "0.8rem" }}>
                · {record.category}
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
            {formatDate(record.created_at)}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--success)" }}>
            {record.final_price !== null ? `₹${record.final_price}` : "—"}
          </div>
          {record.weight !== null && (
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              {record.weight} kg
            </div>
          )}
        </div>

        <span
          style={{
            color: "var(--text-muted)",
            fontSize: "0.9rem",
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
            display: "inline-block",
          }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div
          style={{
            padding: "0 1.25rem 1.25rem",
            borderTop: "1px solid var(--border-subtle)",
            animation: "fadeInUp 0.2s ease",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: "0.75rem",
              marginTop: "1rem",
            }}
          >
            {[
              { label: "Condition",    value: capitalize(record.condition) },
              { label: "Subtype",      value: capitalize(record.subtype) },
              { label: "Cleanliness",  value: capitalize(record.cleanliness) },
              {
                label: "Confidence",
                value: capitalize(record.confidence_level),
                color: confidenceColor(record.confidence_level),
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.5rem 0.75rem",
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                  {label}
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: color ?? "var(--text-primary)" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {record.summary && (
            <p
              style={{
                marginTop: "0.85rem",
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                padding: "0.6rem 0.85rem",
                background: "var(--bg-input)",
                borderRadius: "var(--radius-sm)",
                borderLeft: "3px solid var(--accent)",
              }}
            >
              💡 {record.summary}
            </p>
          )}

          <FeedbackWidget analysisId={record.id} />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser]         = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [records, setRecords]   = useState<AnalysisRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  // ── Auth guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetchHistory(user.id);
      setRecords(res.analyses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
        <span style={{ color: "#94a3b8" }}>Loading…</span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          padding: "1rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link
            href="/"
            style={{
              color: "var(--text-secondary)",
              textDecoration: "none",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--text-primary)")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-secondary)")}
          >
            ← Home
          </Link>
          <span style={{ color: "var(--border-default)" }}>|</span>
          <h1 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
            Analysis History
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {user && (
            <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
              {user.email}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "0.4rem 1rem",
              borderRadius: "var(--radius-full)",
              border: "1px solid var(--border-default)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.8rem",
              transition: "all 0.2s",
            }}
          >
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: "0.4rem 1rem",
              borderRadius: "var(--radius-full)",
              border: "1px solid var(--border-default)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main style={{ maxWidth: "720px", margin: "0 auto", padding: "2rem 1.25rem" }}>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: "72px",
                  background: "var(--bg-card)",
                  borderRadius: "var(--radius-md)",
                  animation: "pulse 1.5s ease-in-out infinite",
                  opacity: 1 - i * 0.2,
                }}
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              background: "var(--error-bg)",
              border: "1px solid var(--error)",
              borderRadius: "var(--radius-md)",
              padding: "1.25rem",
              textAlign: "center",
            }}
          >
            <p style={{ color: "var(--error)", fontWeight: 600, marginBottom: "0.5rem" }}>
              ⚠️ Failed to load history
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1rem" }}>
              {error}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
              Make sure SUPABASE_URL and SUPABASE_KEY are configured in the backend .env file.
            </p>
          </div>
        )}

        {!loading && !error && records.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</div>
            <h2 style={{ color: "var(--text-secondary)", fontWeight: 600, marginBottom: "0.5rem" }}>
              No analyses yet
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              Complete your first valuation to see it here.
            </p>
            <Link
              href="/upload"
              style={{
                display: "inline-block",
                padding: "0.6rem 1.5rem",
                background: "var(--accent)",
                color: "#fff",
                borderRadius: "var(--radius-full)",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
                transition: "background 0.2s",
              }}
            >
              Analyse an Item →
            </Link>
          </div>
        )}

        {!loading && !error && records.length > 0 && (
          <>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "1rem" }}>
              {records.length} {records.length === 1 ? "analysis" : "analyses"} — click any row to expand details
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {records.map((r) => (
                <HistoryRow key={r.id} record={r} />
              ))}
            </div>
          </>
        )}
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: "1.5rem",
          color: "var(--text-muted)",
          fontSize: "0.75rem",
          borderTop: "1px solid var(--border-subtle)",
          marginTop: "2rem",
        }}
      >
        ScrapIQ — Deterministic valuation. Real market rates.
      </footer>
    </div>
  );
}
