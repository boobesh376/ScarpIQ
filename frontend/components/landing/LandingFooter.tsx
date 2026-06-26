"use client";

import Link from "next/link";
import styles from "./Landing.module.css";

const FOOTER_LINKS = {
  Product: [
    { label: "Features",      href: "#features"     },
    { label: "How It Works",  href: "#how-it-works"  },
    { label: "Pricing",       href: "#"              },
    { label: "Changelog",     href: "#"              },
  ],
  Resources: [
    { label: "Documentation", href: "#"              },
    { label: "API Reference", href: "#"              },
    { label: "Blog",          href: "#"              },
    { label: "Market Guide",  href: "#"              },
  ],
  Community: [
    { label: "Forum",         href: "#"              },
    { label: "Discord",       href: "#"              },
    { label: "Twitter / X",   href: "#"              },
    { label: "LinkedIn",      href: "#"              },
  ],
  Company: [
    { label: "About",         href: "#"              },
    { label: "Careers",       href: "#"              },
    { label: "Privacy",       href: "#"              },
    { label: "Terms",         href: "#"              },
  ],
};

export function LandingFooter() {
  const scrollTo = (id: string) => {
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer style={{
      borderTop: "1px solid #1E293B",
      background: "#0F172A",
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "72px 24px 40px" }}>

        {/* Top section */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.5fr repeat(4, 1fr)",
          gap: "40px",
          marginBottom: "60px",
        }} className="footer-grid">

          {/* Brand column */}
          <div>
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              marginBottom: "16px",
            }}>
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
                color: "#F8FAFC",
                letterSpacing: "-0.03em",
              }}>ScrapIQ</span>
            </div>

            <p style={{
              fontSize: "14px",
              color: "#94A3B8",
              lineHeight: 1.7,
              marginBottom: "24px",
              maxWidth: "240px",
            }}>
              AI-powered scrap intelligence. Know the value before you sell.
            </p>

            {/* Social icons */}
            <div style={{ display: "flex", gap: "10px" }}>
              {[
                { icon: "𝕏", label: "Twitter" },
                { icon: "in", label: "LinkedIn" },
                { icon: "◉", label: "Discord" },
              ].map(s => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  style={{
                    width: "36px", height: "36px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#94A3B8",
                    fontSize: "13px",
                    fontWeight: 700,
                    textDecoration: "none",
                    transition: "border-color 0.2s, color 0.2s, background 0.2s",
                    minHeight: "auto",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,200,150,0.4)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "#F8FAFC";
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,200,150,0.12)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.1)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "#94A3B8";
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)";
                  }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <div style={{
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                color: "#F8FAFC",
                marginBottom: "16px",
              }}>
                {category}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {links.map(link => (
                  link.href.startsWith("#") && link.href.length > 1 ? (
                    <button
                      key={link.label}
                      onClick={() => scrollTo(link.href)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "#94A3B8",
                        fontSize: "14px",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "color 0.2s",
                        minHeight: "auto",
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#F8FAFC"}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8"}
                    >
                      {link.label}
                    </button>
                  ) : (
                    <a
                      key={link.label}
                      href={link.href}
                      style={{
                        color: "#94A3B8",
                        fontSize: "14px",
                        textDecoration: "none",
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = "#F8FAFC"}
                      onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = "#94A3B8"}
                    >
                      {link.label}
                    </a>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}>
          <div style={{ fontSize: "13px", color: "#64748B" }}>
            © {new Date().getFullYear()} ScrapIQ. Built with intelligence for the circular economy.
          </div>
          <div style={{ display: "flex", gap: "24px" }}>
            {["Privacy Policy", "Terms of Service", "Cookie Policy"].map(l => (
              <a
                key={l}
                href="#"
                style={{
                  fontSize: "12px",
                  color: "#64748B",
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = "#CBD5E1"}
                onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = "#64748B"}
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .footer-grid > div:first-child {
            grid-column: span 2;
          }
        }
        @media (max-width: 560px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .footer-grid > div:first-child {
            grid-column: span 2;
          }
        }
      `}</style>
    </footer>
  );
}
