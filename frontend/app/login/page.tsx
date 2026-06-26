"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard");
        return;
      }
      setCheckingSession(false);
    };
    checkAuth();
  }, [router]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Avoid flashing the form before the session check resolves
  if (checkingSession) {
    return (
      <div style={s.page}>
        <div style={s.checkingWrap}>
          <div style={s.checkingDot} />
        </div>
      </div>
    );
  }

  return (
    <div style={s.page} className="login-page-grid">
      {/* Left: Brand panel */}
      <div style={s.brandPanel} className="login-brand-panel">
        <div style={s.brandGrid} />
        <div style={s.orb1} />
        <div style={s.orb2} />

        <Link href="/" style={s.brandLogoRow}>
          <div style={s.brandLogoMark}>♻</div>
          <span style={s.brandLogoText}>ScrapIQ</span>
        </Link>

        <div style={s.brandContent}>
          <div style={s.brandEyebrow}>AI-Powered Scrap Intelligence</div>
          <h1 style={s.brandHeadline}>
            Know the value.<br />Every single time.
          </h1>
          <p style={s.brandSub}>
            Sign in to access live valuations, market intelligence, and your
            full analysis history.
          </p>

          {/* Mock analysis preview card */}
          <div style={s.previewCard}>
            <div style={s.previewRow}>
              <div style={s.previewIconWrap}>🔌</div>
              <div style={{ flex: 1 }}>
                <div style={s.previewTitle}>Copper Wire Bundle</div>
                <div style={s.previewSub}>Grade A · 97% confidence</div>
              </div>
              <div style={s.previewValue}>₹8,400</div>
            </div>
            <div style={s.previewBarTrack}>
              <div style={s.previewBarFill} />
            </div>
          </div>

          <div style={s.brandStatsRow}>
            <div>
              <div style={s.brandStatValue}>124K+</div>
              <div style={s.brandStatLabel}>Analyses</div>
            </div>
            <div style={s.brandStatDivider} />
            <div>
              <div style={s.brandStatValue}>97%</div>
              <div style={s.brandStatLabel}>Accuracy</div>
            </div>
            <div style={s.brandStatDivider} />
            <div>
              <div style={s.brandStatValue}>5,000+</div>
              <div style={s.brandStatLabel}>Users</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Form panel */}
      <div style={s.formPanel}>
        <div style={s.formWrap}>
          {/* Mobile-only logo */}
          <Link href="/" style={s.mobileLogoRow} className="login-mobile-logo">
            <div style={s.mobileLogoMark}>♻</div>
            <span style={s.mobileLogoText}>ScrapIQ</span>
          </Link>

          <div style={s.formHeader}>
            <h2 style={s.formTitle}>Welcome back</h2>
            <p style={s.formSubtitle}>Sign in to your ScrapIQ account</p>
          </div>

          <form onSubmit={handleLogin} style={s.form} noValidate>
            <div style={s.field}>
              <label style={s.label} htmlFor="email">
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
                style={s.input}
                disabled={loading}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#00C896")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#E2E8F0")}
              />
            </div>

            <div style={s.field}>
              <div style={s.labelRow}>
                <label style={s.label} htmlFor="password">
                  Password
                </label>
                <Link href="#" style={s.forgotLink}>
                  Forgot password?
                </Link>
              </div>
              <div style={s.passwordWrap}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...s.input, paddingRight: "44px" }}
                  disabled={loading}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#00C896")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E2E8F0")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={s.eyeBtn}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M2 9s2.5-5.5 7-5.5S16 9 16 9s-2.5 5.5-7 5.5S2 9 2 9z" stroke="#64748B" strokeWidth="1.4"/>
                      <circle cx="9" cy="9" r="2" stroke="#64748B" strokeWidth="1.4"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M2 9s2.5-5.5 7-5.5S16 9 16 9s-2.5 5.5-7 5.5S2 9 2 9z" stroke="#94A3B8" strokeWidth="1.4"/>
                      <path d="M3 3l12 12" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div style={s.error} role="alert">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="8" cy="8" r="7" stroke="#DC2626" strokeWidth="1.4"/>
                  <path d="M8 5v4M8 11h.01" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{ ...s.button, opacity: loading ? 0.75 : 1 }}
              disabled={loading}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget.style.background = "#00B383");
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget.style.background = "#00C896");
              }}
            >
              {loading ? (
                <span style={s.spinner} />
              ) : (
                <>
                  Sign In
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p style={s.footer}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" style={s.link}>
              Sign up free
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes loginSpin { to { transform: rotate(360deg); } }
        @keyframes checkingPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
        @media (max-width: 900px) {
          .login-page-grid { grid-template-columns: 1fr !important; }
          .login-brand-panel { display: none !important; }
          .login-mobile-logo { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    fontFamily: "'Inter', system-ui, sans-serif",
    background: "#F8FAFC",
  },
  checkingWrap: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gridColumn: "1 / -1",
  },
  checkingDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#00C896",
    animation: "checkingPulse 1s ease-in-out infinite",
  },

  /* ── Brand panel (left) ───────────────────────────────────────────── */
  brandPanel: {
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(160deg, #0F172A 0%, #0B1220 100%)",
    padding: "48px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  brandGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
    backgroundSize: "48px 48px",
    maskImage: "radial-gradient(ellipse 80% 80% at 30% 20%, black 0%, transparent 100%)",
    pointerEvents: "none",
  },
  orb1: {
    position: "absolute",
    width: "420px",
    height: "420px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,200,150,0.18) 0%, transparent 70%)",
    top: "-120px",
    left: "-100px",
    pointerEvents: "none",
  },
  orb2: {
    position: "absolute",
    width: "360px",
    height: "360px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)",
    bottom: "-100px",
    right: "-80px",
    pointerEvents: "none",
  },
  brandLogoRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
    position: "relative",
    zIndex: 1,
  },
  brandLogoMark: {
    width: "34px",
    height: "34px",
    borderRadius: "9px",
    background: "linear-gradient(135deg, #00C896, #5EEAD4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "17px",
  },
  brandLogoText: {
    fontSize: "19px",
    fontWeight: 800,
    color: "#F8FAFC",
    letterSpacing: "-0.03em",
  },
  brandContent: {
    position: "relative",
    zIndex: 1,
    maxWidth: "440px",
  },
  brandEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#5EEAD4",
    background: "rgba(0,200,150,0.12)",
    border: "1px solid rgba(0,200,150,0.28)",
    borderRadius: "999px",
    padding: "5px 14px",
    marginBottom: "24px",
  },
  brandHeadline: {
    fontSize: "clamp(28px, 3.4vw, 38px)",
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
    color: "#F8FAFC",
    marginBottom: "16px",
  },
  brandSub: {
    fontSize: "15px",
    color: "#94A3B8",
    lineHeight: 1.7,
    marginBottom: "32px",
  },
  previewCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    padding: "18px",
    backdropFilter: "blur(12px)",
    marginBottom: "32px",
  },
  previewRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "14px",
  },
  previewIconWrap: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "rgba(255,184,0,0.12)",
    border: "1px solid rgba(255,184,0,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    flexShrink: 0,
  },
  previewTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#F8FAFC",
  },
  previewSub: {
    fontSize: "11px",
    color: "#64748B",
    marginTop: "2px",
  },
  previewValue: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#5EEAD4",
  },
  previewBarTrack: {
    height: "4px",
    borderRadius: "2px",
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  previewBarFill: {
    height: "100%",
    width: "97%",
    borderRadius: "2px",
    background: "linear-gradient(90deg, #00C896, #5EEAD4)",
  },
  brandStatsRow: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },
  brandStatValue: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#F8FAFC",
    letterSpacing: "-0.02em",
  },
  brandStatLabel: {
    fontSize: "11px",
    color: "#64748B",
    marginTop: "2px",
  },
  brandStatDivider: {
    width: "1px",
    height: "28px",
    background: "rgba(255,255,255,0.1)",
  },

  /* ── Form panel (right) ───────────────────────────────────────────── */
  formPanel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 24px",
  },
  formWrap: {
    width: "100%",
    maxWidth: "380px",
  },
  mobileLogoRow: {
    display: "none",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
    marginBottom: "32px",
  },
  mobileLogoMark: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #00C896, #5EEAD4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
  },
  mobileLogoText: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#0F172A",
    letterSpacing: "-0.03em",
  },
  formHeader: {
    marginBottom: "32px",
  },
  formTitle: {
    fontSize: "28px",
    fontWeight: 800,
    color: "#0F172A",
    letterSpacing: "-0.03em",
    marginBottom: "8px",
  },
  formSubtitle: {
    fontSize: "15px",
    color: "#475569",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  labelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#334155",
  },
  forgotLink: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#00B383",
    textDecoration: "none",
  },
  input: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    color: "#0F172A",
    fontSize: "15px",
    padding: "12px 14px",
    outline: "none",
    transition: "border-color 0.15s ease",
    width: "100%",
    boxSizing: "border-box",
  },
  passwordWrap: {
    position: "relative",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "auto",
  },
  error: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(220,38,38,0.06)",
    border: "1px solid rgba(220,38,38,0.2)",
    borderRadius: "10px",
    color: "#B91C1C",
    fontSize: "13px",
    fontWeight: 500,
    padding: "11px 14px",
  },
  button: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    background: "#00C896",
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: 700,
    padding: "13px",
    transition: "background 0.15s ease, transform 0.1s ease",
    width: "100%",
    letterSpacing: "-0.01em",
  },
  spinner: {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.4)",
    borderTopColor: "#fff",
    display: "inline-block",
    animation: "loginSpin 0.7s linear infinite",
  },
  footer: {
    color: "#64748B",
    fontSize: "14px",
    marginTop: "28px",
    textAlign: "center",
  },
  link: {
    color: "#00B383",
    textDecoration: "none",
    fontWeight: 700,
  },
};
