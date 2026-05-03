"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Stage = "form" | "verify";

export default function SignupPage() {
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setStage("verify");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (stage === "verify") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.verifyIcon}>📬</div>
          <h2 style={styles.verifyTitle}>Check your email</h2>
          <p style={styles.verifyText}>
            We sent a verification link to{" "}
            <strong style={{ color: "#22c55e" }}>{email}</strong>. Click the
            link to activate your account, then{" "}
            <Link href="/login" style={styles.link}>
              sign in
            </Link>
            .
          </p>
          <Link href="/login" style={styles.backBtn}>
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Brand */}
        <div style={styles.brand}>
          <span style={styles.logo}>♻️</span>
          <h1 style={styles.title}>ScrapIQ</h1>
          <p style={styles.subtitle}>Create a free account</p>
        </div>

        <form onSubmit={handleSignup} style={styles.form} noValidate>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="confirm">
              Confirm Password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              style={styles.input}
              disabled={loading}
            />
          </div>

          {error && (
            <div style={styles.error} role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{" "}
          <Link href="/login" style={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    fontFamily: "'Inter', sans-serif",
    padding: "1rem",
  },
  card: {
    background: "#1e293b",
    borderRadius: "16px",
    padding: "2.5rem",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  brand: {
    textAlign: "center",
    marginBottom: "2rem",
  },
  logo: { fontSize: "2.5rem" },
  title: {
    color: "#f1f5f9",
    fontSize: "1.75rem",
    fontWeight: 800,
    margin: "0.25rem 0 0.25rem",
    letterSpacing: "-0.5px",
  },
  subtitle: { color: "#94a3b8", fontSize: "0.9rem", margin: 0 },
  form: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  field: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  label: { color: "#cbd5e1", fontSize: "0.875rem", fontWeight: 500 },
  input: {
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#f1f5f9",
    fontSize: "0.95rem",
    padding: "0.65rem 0.85rem",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  error: {
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.4)",
    borderRadius: "8px",
    color: "#fca5a5",
    fontSize: "0.85rem",
    padding: "0.65rem 0.85rem",
  },
  button: {
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: 700,
    marginTop: "0.25rem",
    padding: "0.8rem",
    width: "100%",
    letterSpacing: "0.01em",
  },
  footer: {
    color: "#64748b",
    fontSize: "0.875rem",
    marginTop: "1.5rem",
    textAlign: "center",
  },
  link: { color: "#22c55e", textDecoration: "none", fontWeight: 600 },
  // Verify stage
  verifyIcon: {
    fontSize: "3rem",
    textAlign: "center",
    marginBottom: "1rem",
  },
  verifyTitle: {
    color: "#f1f5f9",
    fontSize: "1.5rem",
    fontWeight: 700,
    textAlign: "center",
    margin: "0 0 1rem",
  },
  verifyText: {
    color: "#94a3b8",
    fontSize: "0.9rem",
    lineHeight: 1.6,
    textAlign: "center",
    margin: "0 0 1.5rem",
  },
  backBtn: {
    display: "block",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "#f1f5f9",
    fontSize: "0.9rem",
    fontWeight: 600,
    padding: "0.75rem",
    textAlign: "center",
    textDecoration: "none",
  },
};
