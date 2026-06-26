"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category  = "market" | "tips" | "setup" | "general";
type SortMode  = "latest" | "popular";
type FilterMode = Category | "all";

interface Post {
  id: string; title: string; content: string;
  author: string; hoursAgo: number; displayTime: string;
  category: Category; likes: number; comments: number; liked: boolean;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  mint:    "#F2FBF7", softGreen: "#EAF8F1", copper: "#FFF7F1",
  lavender:"#F8F4FF", sky: "#F0FAFF", white: "#FFFFFF",
  border:  "#DCEAE2", green: "#10B981", emerald: "#059669",
  muted:   "#64748B", text: "#0F172A", subtle: "#94A3B8",
  amber:   "#D97706", violet: "#8B5CF6", sky2: "#38BDF8", red: "#EF4444",
};

// ─── Category config (light-mode palette) ─────────────────────────────────────

const CATEGORY_META: Record<Category, { label: string; bg: string; color: string; border: string; icon: string }> = {
  market:  { label: "Market",  bg: "#D1FAE5", color: "#059669", border: "rgba(5,150,105,0.3)",    icon: "📈" },
  tips:    { label: "Tips",    bg: "#DBEAFE", color: "#0284C7", border: "rgba(2,132,199,0.3)",    icon: "💡" },
  setup:   { label: "Setup",   bg: "#FEF3C7", color: "#D97706", border: "rgba(217,119,6,0.3)",   icon: "⚙️" },
  general: { label: "General", bg: "#F3F4F6", color: "#4B5563", border: "rgba(75,85,99,0.3)",    icon: "💬" },
};

// ─── Static data ──────────────────────────────────────────────────────────────

const SEED_POSTS: Post[] = [
  { id: "1", title: "Copper prices surging in Chennai — sell now?", content: "Noticed copper hitting higher rates at local yards today. Might be short-lived due to a global supply crunch. Anyone else seeing this?", author: "Ramesh K.", hoursAgo: 2,  displayTime: "2h ago",  category: "market",  likes: 24, comments: 8,  liked: false },
  { id: "2", title: "Best way to clean aluminum before selling",     content: "Learned this the hard way — pressure wash and dry completely. Wet aluminum gets docked 15–20% at most yards. A few hours of drying makes a real difference.", author: "Priya M.", hoursAgo: 5, displayTime: "5h ago", category: "tips", likes: 41, comments: 13, liked: false },
  { id: "3", title: "Steel market slowing this week in Tamil Nadu", content: "Three yards told me they are buying less steel until seasonal demand picks back up. Holding my stock for now — anyone else doing the same?", author: "Anand B.", hoursAgo: 8, displayTime: "8h ago", category: "market", likes: 17, comments: 5, liked: false },
  { id: "4", title: "Scrap yard setup tips — what I wish I knew earlier", content: "After 2 years: get a good magnet first to separate ferrous and non-ferrous fast, buy a digital scale early, and never mix grades. Consistent sorting earns more than you expect.", author: "Vijay S.", hoursAgo: 24, displayTime: "1d ago", category: "setup", likes: 63, comments: 22, liked: false },
  { id: "5", title: "Brass from electrical components — worth stripping?", content: "Got a batch of old switchgear. Brass fittings are decent quality. Stripping vs. selling mixed shows a meaningful per-kg price difference — stripping wins at high volume.", author: "Karthik R.", hoursAgo: 26, displayTime: "1d ago", category: "tips", likes: 29, comments: 10, liked: false },
  { id: "6", title: "PET vs HDPE plastic — the pricing gap is large", content: "HDPE bottles fetch significantly more per kg than PET at the same yard. Worth learning to identify them before hauling a full load.", author: "Meena L.", hoursAgo: 48, displayTime: "2d ago", category: "market", likes: 35, comments: 7, liked: false },
  { id: "7", title: "Setting up a basic sorting station on a budget", content: "Built a working sort area for under ₹8,000. Key items: a heavy-duty tarp, labelled bins, a 150 kg floor scale, and a strong neodymium magnet. Happy to share the full list if useful.", author: "Dinesh T.", hoursAgo: 52, displayTime: "2d ago", category: "setup", likes: 44, comments: 18, liked: false },
  { id: "8", title: "Iron scrap — negotiate by the tonne, not the kg", content: "Most yards will move on iron pricing once you bring 500 kg or more at once. Always quote in tonnes when you have volume — made a noticeable difference on my last haul.", author: "Suresh P.", hoursAgo: 72, displayTime: "3d ago", category: "tips", likes: 52, comments: 9, liked: false },
];

const TRENDING_MATERIALS = [
  { name: "Copper",   icon: "🟤", up: true,  pct: "+3.7%", color: "#C2410C", surface: "#FFF7F1", border: "#FDDCBF" },
  { name: "Aluminum", icon: "⚪", up: false, pct: "-1.9%", color: "#0284C7", surface: "#F0FAFF", border: "#BAE6FD" },
  { name: "Steel",    icon: "🔩", up: true,  pct: "+4.5%", color: "#475569", surface: "#F8FAFC", border: "#CBD5E1" },
  { name: "Brass",    icon: "🟡", up: true,  pct: "+3.8%", color: "#D97706", surface: "#FEFCE8", border: "#FDE68A" },
  { name: "Plastic",  icon: "♻️", up: true,  pct: "+12%",  color: "#059669", surface: "#F2FBF7", border: "#A7F3D0" },
  { name: "Iron",     icon: "⚙️", up: false, pct: "-0.5%", color: "#334155", surface: "#F1F5F9", border: "#CBD5E1" },
];

const INDUSTRY_TIPS = [
  { icon: "✂️", title: "Separate copper before selling",  text: "Mixed copper earns 20–30% less than clean separated grades.", color: "#C2410C", surface: "#FFF7F1", border: "#FDDCBF" },
  { icon: "💧", title: "Dry plastic before delivery",     text: "Wet plastic triggers deductions of up to 15% at most yards.", color: "#0284C7", surface: "#F0FAFF", border: "#BAE6FD" },
  { icon: "🔴", title: "Prevent rust contamination",      text: "Even minor rust lowers the grade of an entire steel batch.",  color: "#DC2626", surface: "#FEF2F2", border: "#FECACA" },
  { icon: "📦", title: "Sort loads by grade",             text: "Pre-sorted loads process faster and often earn a premium.",   color: "#059669", surface: "#F2FBF7", border: "#A7F3D0" },
];

const QUICK_ACTIONS = [
  { label: "Analyze Scrap", icon: "📤", href: "/upload",    color: "#059669", surface: "#D1FAE5", border: "rgba(5,150,105,0.3)"   },
  { label: "View Prices",   icon: "💰", href: "/prices",    color: "#D97706", surface: "#FEF3C7", border: "rgba(217,119,6,0.3)"   },
  { label: "My History",    icon: "📜", href: "/history",   color: "#0284C7", surface: "#DBEAFE", border: "rgba(2,132,199,0.3)"   },
  { label: "Dashboard",     icon: "📊", href: "/dashboard", color: "#8B5CF6", surface: "#EDE9FE", border: "rgba(139,92,246,0.3)"  },
];

const STATS = [
  { label: "Active Traders", value: "1,284", icon: "👥", color: "#059669", surface: "#D1FAE5", border: "rgba(5,150,105,0.25)"  },
  { label: "Posts Today",    value: "47",    icon: "💬", color: "#0284C7", surface: "#DBEAFE", border: "rgba(2,132,199,0.25)"  },
  { label: "Market Alerts",  value: "12",    icon: "🔔", color: "#D97706", surface: "#FEF3C7", border: "rgba(217,119,6,0.25)"  },
  { label: "Top Material",   value: "Copper",icon: "🏆", color: "#8B5CF6", surface: "#EDE9FE", border: "rgba(139,92,246,0.25)" },
];

const LEADERBOARD = [
  { name: "Vijay S.",   analyses: 48, value: "₹1.2L", badge: "🥇", rank: 1 },
  { name: "Priya M.",   analyses: 41, value: "₹98K",  badge: "🥈", rank: 2 },
  { name: "Ramesh K.",  analyses: 37, value: "₹86K",  badge: "🥉", rank: 3 },
  { name: "Dinesh T.",  analyses: 29, value: "₹64K",  badge: "4",  rank: 4 },
  { name: "Karthik R.", analyses: 22, value: "₹51K",  badge: "5",  rank: 5 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function postMatchesSearch(post: Post, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase();
  return post.title.toLowerCase().includes(lower) || post.content.toLowerCase().includes(lower) || post.author.toLowerCase().includes(lower) || CATEGORY_META[post.category].label.toLowerCase().includes(lower);
}

function getInitials(name: string): string {
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

function authorColor(name: string): string {
  const colors = ["#059669","#0284C7","#D97706","#8B5CF6","#C2410C","#DC2626"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── LivePulse ────────────────────────────────────────────────────────────────

function LivePulse({ color = T.green, size = 7 }: { color?: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: size + 4, height: size + 4 }}>
      <span style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: color, opacity: 0.3, animation: "dRipple 2s ease-out infinite" }} />
      <span style={{ width: size, height: size, borderRadius: "50%", background: color, display: "block" }} />
    </span>
  );
}

// ─── ZoneLabel ────────────────────────────────────────────────────────────────

function ZoneLabel({ icon, text, color, live }: { icon: string; text: string; color: string; live?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: `${color}12`, border: `1.5px solid ${color}28`, borderRadius: 999, padding: "5px 13px 5px 9px", fontSize: 11.5, fontWeight: 700, color, letterSpacing: "0.025em" }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      {text}
      {live && <LivePulse color={color} />}
    </div>
  );
}

// ─── Community Stats Row ──────────────────────────────────────────────────────

function CommunityStats() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
      {STATS.map((s, i) => (
        <div key={s.label}
          style={{ background: "#FFFFFF", border: `1.5px solid ${s.border}`, borderRadius: 16, padding: "16px 14px", textAlign: "center", opacity: 0, animation: "dReveal 0.5s cubic-bezier(0.16,1,0.3,1) forwards", animationDelay: `${0.04 + i * 0.06}s`, transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 10px 24px ${s.color}18`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 11, background: s.surface, border: `1px solid ${s.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, margin: "0 auto 10px" }}>{s.icon}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: s.color, letterSpacing: "-0.03em", marginBottom: 3 }}>{s.value}</div>
          <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 500 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Market Pulse (sidebar) ────────────────────────────────────────────────────

function MarketPulse() {
  return (
    <div style={{ background: "#F7FDF9", border: "1.5px solid #C8E8D8", borderRadius: 18, padding: "18px 16px", marginBottom: 12 }}>
      <div style={{ marginBottom: 14 }}>
        <ZoneLabel icon="📡" text="Market Pulse" color={T.emerald} live />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {TRENDING_MATERIALS.map((m, i) => (
          <div key={m.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < TRENDING_MATERIALS.length - 1 ? `1px solid ${T.border}` : "none", cursor: "default", transition: "background 0.15s ease", borderRadius: 8 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = m.surface; (e.currentTarget as HTMLElement).style.padding = "9px 8px"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.padding = "9px 0"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: m.surface, border: `1.5px solid ${m.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{m.icon}</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{m.name}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: m.up ? "#059669" : T.red, padding: "2px 9px", borderRadius: 999, background: m.up ? "#D1FAE5" : "#FEE2E2", border: `1px solid ${m.up ? "rgba(5,150,105,0.25)" : "rgba(220,38,38,0.25)"}` }}>
              {m.up ? "↑" : "↓"} {m.pct}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Knowledge Center (sidebar) ───────────────────────────────────────────────

function KnowledgeCenter() {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  return (
    <div style={{ background: "#F0FAFF", border: "1.5px solid #BAE6FD", borderRadius: 18, padding: "18px 16px", marginBottom: 12 }}>
      <div style={{ marginBottom: 14 }}>
        <ZoneLabel icon="📚" text="Knowledge Center" color={T.sky2} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {INDUSTRY_TIPS.map(tip => (
          <div key={tip.title}
            style={{ background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "12px 13px", display: "flex", gap: 10, alignItems: "flex-start", transition: "border-color 0.2s ease, transform 0.2s ease" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = tip.border; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.transform = ""; }}
          >
            <div style={{ width: 30, height: 30, borderRadius: 9, background: tip.surface, border: `1.5px solid ${tip.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{tip.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, marginBottom: 3, lineHeight: 1.3 }}>{tip.title}</div>
              <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.5 }}>{tip.text}</div>
            </div>
            <button onClick={() => setSaved(s => { const n = new Set(s); n.has(tip.title) ? n.delete(tip.title) : n.add(tip.title); return n; })}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: saved.has(tip.title) ? T.amber : T.subtle, flexShrink: 0, padding: "2px" }}>
              {saved.has(tip.title) ? "🔖" : "📑"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Community Leaderboard (sidebar) ─────────────────────────────────────────

function Leaderboard() {
  return (
    <div style={{ background: "#F5F3FF", border: "1.5px solid #DDD6FE", borderRadius: 18, padding: "18px 16px", marginBottom: 12 }}>
      <div style={{ marginBottom: 14 }}>
        <ZoneLabel icon="🏆" text="Top Contributors" color={T.violet} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {LEADERBOARD.map((member, i) => {
          const color = authorColor(member.name);
          return (
            <div key={member.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#FFFFFF", border: `1.5px solid ${i === 0 ? "rgba(217,119,6,0.3)" : T.border}`, borderRadius: 12, transition: "transform 0.18s ease, box-shadow 0.18s ease" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateX(3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(139,92,246,0.1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
            >
              <div style={{ fontSize: i < 3 ? 18 : 13, fontWeight: 800, width: 22, textAlign: "center", color: i < 3 ? undefined : T.muted, flexShrink: 0 }}>{member.badge}</div>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${color}20`, border: `1.5px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800, color, flexShrink: 0 }}>{getInitials(member.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{member.name}</div>
                <div style={{ fontSize: 10.5, color: T.muted }}>{member.analyses} analyses</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.emerald, flexShrink: 0 }}>{member.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quick Actions (sidebar) ──────────────────────────────────────────────────

function QuickActionsSidebar() {
  return (
    <div style={{ background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 18, padding: "18px 16px" }}>
      <div style={{ marginBottom: 14 }}>
        <ZoneLabel icon="⚡" text="Quick Actions" color={T.amber} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {QUICK_ACTIONS.map(a => (
          <Link key={a.label} href={a.href}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "14px 10px", background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 14, textDecoration: "none", transition: "all 0.2s ease", textAlign: "center" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = a.surface; el.style.borderColor = a.border; el.style.transform = "translateY(-2px)"; el.style.boxShadow = `0 8px 20px ${a.color}18`; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#FFFFFF"; el.style.borderColor = T.border; el.style.transform = ""; el.style.boxShadow = ""; }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 10, background: a.surface, border: `1.5px solid ${a.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{a.icon}</div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Category Badge ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: Category }) {
  const meta = CATEGORY_META[category];
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 9px", borderRadius: 999, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, letterSpacing: "0.04em", whiteSpace: "nowrap", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, onLike }: { post: Post; onLike: (id: string) => void }) {
  const [hov, setHov] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const meta = CATEGORY_META[post.category];
  const color = authorColor(post.author);

  // AI relevance score derived from engagement
  const aiScore = Math.min(99, 60 + Math.round(post.likes * 0.8 + post.comments * 1.2));

  return (
    <article
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? meta.bg.replace(")", ", 0.15)").replace("rgb", "rgba") : "#FFFFFF",
        border: `1.5px solid ${hov ? meta.border : T.border}`,
        borderRadius: 18, padding: "18px 20px",
        transition: "all 0.22s cubic-bezier(0.16,1,0.3,1)",
        transform: hov ? "translateY(-2px)" : undefined,
        boxShadow: hov ? `0 12px 32px ${meta.color}14` : "0 1px 4px rgba(15,23,42,0.05)",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Top accent on hover */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${meta.color}00, ${meta.color}, ${meta.color}00)`, opacity: hov ? 1 : 0, transition: "opacity 0.25s ease", borderRadius: "18px 18px 0 0" }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <h3 style={{ fontSize: 14.5, fontWeight: 700, color: T.text, margin: 0, lineHeight: 1.4, flex: 1, minWidth: 0 }}>{post.title}</h3>
        <CategoryBadge category={post.category} />
      </div>

      {/* Content */}
      <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.65, margin: "0 0 14px" }}>
        {expanded || post.content.length < 120 ? post.content : post.content.slice(0, 120) + "…"}
        {post.content.length >= 120 && (
          <button onClick={() => setExpanded(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", color: meta.color, fontSize: 12, fontWeight: 700, padding: "0 0 0 4px" }}>
            {expanded ? " Less" : " More"}
          </button>
        )}
      </p>

      {/* AI relevance bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 10, color: T.subtle, fontWeight: 600, flexShrink: 0, width: 72 }}>AI Relevance</span>
        <div style={{ flex: 1, height: 4, background: "rgba(0,0,0,0.07)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${aiScore}%`, background: `linear-gradient(90deg, ${meta.color}, ${meta.color}99)`, borderRadius: 99, boxShadow: `0 0 6px ${meta.color}40` }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, flexShrink: 0 }}>{aiScore}%</span>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* Author */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${color}20`, border: `1.5px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color, flexShrink: 0 }}>
            {getInitials(post.author)}
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{post.author}</span>
          <span style={{ fontSize: 11, color: T.subtle }}>{post.displayTime}</span>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => onLike(post.id)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: post.liked ? "#DC2626" : T.subtle, padding: "4px 8px", borderRadius: 8, transition: "background 0.15s ease" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FEE2E2"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            {post.liked ? "❤️" : "🤍"} {post.likes}
          </button>
          <span style={{ fontSize: 12.5, color: T.subtle, display: "flex", alignItems: "center", gap: 4 }}>
            💬 {post.comments}
          </span>
          <button onClick={() => setSaved(p => !p)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: saved ? T.amber : T.subtle, padding: "4px", transition: "transform 0.18s ease" }}
            title={saved ? "Unsave" : "Save"}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
          >
            {saved ? "🔖" : "📑"}
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── Empty feed ────────────────────────────────────────────────────────────────

function EmptyFeed({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "52px 20px", background: "#FFFFFF", border: `1.5px dashed ${T.border}`, borderRadius: 18 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{hasSearch ? "🔍" : "📭"}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 5 }}>{hasSearch ? "No posts match your search" : "Nothing here yet"}</div>
      <div style={{ fontSize: 12.5, color: T.muted }}>{hasSearch ? "Try a different keyword or clear your filters" : "Check back soon for new community updates"}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Community Today's Digest Panel ─────────────────────────────────────────
// One unified premium information panel replacing the cramped stacked cards.
// Four content rows: hot material · trending discussion · AI insight · expert tip.
// Rich typographic hierarchy, left-border accent colours, no wasted space.

const DIGEST_ROWS = [
  {
    accent:  "#C2410C",
    surface: "#FFF7F1",
    icon:    "🔥",
    kicker:  "Hottest Material",
    title:   "Copper Wire",
    meta:    "+3.7% · ₹8,750/kg · Very High Demand",
  },
  {
    accent:  "#0284C7",
    surface: "#F0FAFF",
    icon:    "💬",
    kicker:  "Trending Discussion",
    title:   "\"Best scrap yards in Chennai?\"",
    meta:    "47 replies · 2 h ago · 284 views",
  },
  {
    accent:  "#6D28D9",
    surface: "#F5F3FF",
    icon:    "🤖",
    kicker:  "AI Market Insight",
    title:   "Steel demand rising next 5 days",
    meta:    "Seasonal uptick — optimal sell window",
  },
  {
    accent:  "#059669",
    surface: "#F0FDF4",
    icon:    "💡",
    kicker:  "Expert Tip",
    title:   "Sort before you sell",
    meta:    "Segregated loads fetch 12–18% more",
  },
];

function CommunityNetworkGraphic() {
  return (
    <div style={{
      flexShrink: 0,
      width: 224,
      background: "rgba(255,255,255,0.80)",
      border: "1.5px solid rgba(5,150,105,0.22)",
      borderRadius: 20,
      overflow: "hidden",
      backdropFilter: "blur(10px)",
      boxShadow: "0 4px 24px rgba(15,23,42,0.07), 0 1px 4px rgba(15,23,42,0.04)",
    }}>
      {/* Panel header */}
      <div style={{
        padding: "11px 14px 10px",
        background: "linear-gradient(90deg, rgba(5,150,105,0.10), rgba(5,150,105,0.04))",
        borderBottom: "1px solid rgba(5,150,105,0.14)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{
            width: 6, height: 6,
            borderRadius: "50%",
            background: T.green,
            boxShadow: "0 0 6px rgba(16,185,129,0.7)",
            display: "inline-block",
            flexShrink: 0,
            animation: "dRipple 2.2s ease-out infinite",
          }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: "#0A2218", letterSpacing: "0.07em", textTransform: "uppercase" }}>
            Today&apos;s Digest
          </span>
        </div>
        <span style={{ fontSize: 9.5, fontWeight: 600, color: "#94A3B8" }}>
          Live
        </span>
      </div>

      {/* Digest rows */}
      <div style={{ padding: "6px 0" }}>
        {DIGEST_ROWS.map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "9px 13px",
              borderLeft: `3px solid ${row.accent}`,
              marginLeft: 8,
              marginRight: 8,
              marginBottom: i < DIGEST_ROWS.length - 1 ? 3 : 0,
              borderRadius: "0 10px 10px 0",
              background: row.surface,
              opacity: 0,
              animation: `dReveal 0.4s cubic-bezier(0.16,1,0.3,1) ${0.06 + i * 0.07}s forwards`,
            }}
          >
            {/* Icon */}
            <div style={{
              width: 28, height: 28,
              borderRadius: 8,
              background: "rgba(255,255,255,0.85)",
              border: `1px solid ${row.accent}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13,
              flexShrink: 0,
              boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
            }}>
              {row.icon}
            </div>

            {/* Text */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 8.5,
                fontWeight: 700,
                color: row.accent,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                marginBottom: 2,
              }}>
                {row.kicker}
              </div>
              <div style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "#0F172A",
                lineHeight: 1.3,
                marginBottom: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {row.title}
              </div>
              <div style={{
                fontSize: 9.5,
                color: "#64748B",
                fontWeight: 500,
                lineHeight: 1.4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {row.meta}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: "8px 14px",
        borderTop: "1px solid rgba(5,150,105,0.10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 9.5, color: "#94A3B8", fontWeight: 500 }}>
          1,284 traders active
        </span>
        <span style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: T.emerald,
          cursor: "pointer",
          letterSpacing: "0.02em",
        }}>
          View all →
        </span>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const [posts, setPosts]         = useState<Post[]>(SEED_POSTS);
  const [search, setSearch]       = useState("");
  const [catFilter, setCatFilter] = useState<FilterMode>("all");
  const [sortMode, setSortMode]   = useState<SortMode>("latest");
  const [searchFocus, setSearchFocus] = useState(false);

  function handleLike(id: string) {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p));
  }

  const filteredPosts = useMemo(() => {
    let result = posts.filter(p => (catFilter === "all" || p.category === catFilter) && postMatchesSearch(p, search));
    return [...result].sort((a, b) => sortMode === "popular" ? b.likes - a.likes : a.hoursAgo - b.hoursAgo);
  }, [posts, search, catFilter, sortMode]);

  const catOptions: Array<{ value: FilterMode; label: string; icon: string }> = [
    { value: "all",    label: "All",    icon: "📋" },
    { value: "market", label: "Market", icon: "📈" },
    { value: "tips",   label: "Tips",   icon: "💡" },
    { value: "setup",  label: "Setup",  icon: "⚙️" },
  ];

  return (
    <>
      <div style={{ maxWidth: 1320, margin: "0 auto", fontFamily: "'Inter', system-ui, sans-serif", color: T.text }}>

        {/* ── PAGE HERO ── */}
        <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(140deg, #EDFAF4 0%, #D4F1E4 35%, #E8F4FF 70%, #EEE8FF 100%)", border: "1.5px solid #B8E6D0", borderRadius: 24, padding: "34px 30px", marginBottom: 14, animation: "dReveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
          <div style={{ position: "absolute", top: -90, right: -70, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 65%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -70, left: "10%", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ marginBottom: 16 }}>
              <ZoneLabel icon="🏭" text="ScrapIQ Industry Intelligence Hub" color={T.emerald} live />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "center" }}>
              <div>
                <h1 style={{ fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 900, letterSpacing: "-0.04em", color: "#0A2218", lineHeight: 1.15, marginBottom: 8 }}>
                  Industry Intelligence Hub 🤝
                </h1>
                <p style={{ fontSize: 14.5, color: "#374151", lineHeight: 1.65, maxWidth: 460 }}>
                  Market updates, expert tips, and real insights from India's smartest scrap intelligence network.
                </p>
              </div>
              <CommunityNetworkGraphic />
            </div>
          </div>
        </div>

        {/* Stats */}
        <CommunityStats />

        {/* ── TWO COLUMN GRID ── */}
        <div className="hub-grid">

          {/* ── FEED COLUMN ── */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Search + filter bar */}
            <div style={{ background: "#F7FDF9", border: "1.5px solid #C8E8D8", borderRadius: 18, padding: "16px 18px" }}>
              <div style={{ marginBottom: 12 }}>
                <ZoneLabel icon="🔎" text="Discussion Feed" color={T.emerald} />
              </div>
              {/* Search */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
                <input type="text" placeholder="Search posts, tips, topics…" value={search} onChange={e => setSearch(e.target.value)}
                  onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 14px 9px 36px", background: "#FFFFFF", border: `1.5px solid ${searchFocus ? T.green : T.border}`, borderRadius: 11, color: T.text, fontSize: 13.5, outline: "none", transition: "border-color 0.18s ease", boxShadow: searchFocus ? `0 0 0 3px rgba(16,185,129,0.1)` : undefined }} />
              </div>

              {/* Filter + sort */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {catOptions.map(o => (
                    <button key={o.value} onClick={() => setCatFilter(o.value)}
                      style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${catFilter === o.value ? T.green : T.border}`, background: catFilter === o.value ? "#D1FAE5" : "#FFFFFF", color: catFilter === o.value ? T.emerald : T.muted, whiteSpace: "nowrap", transition: "all 0.18s ease" }}>
                      {o.icon} {o.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>Sort:</span>
                  {(["latest", "popular"] as SortMode[]).map(s => (
                    <button key={s} onClick={() => setSortMode(s)}
                      style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${sortMode === s ? T.violet : T.border}`, background: sortMode === s ? "#EDE9FE" : "#FFFFFF", color: sortMode === s ? T.violet : T.muted, transition: "all 0.18s ease" }}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Post list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredPosts.length > 0
                ? filteredPosts.map((post, i) => (
                    <div key={post.id} style={{ opacity: 0, animation: "dReveal 0.5s cubic-bezier(0.16,1,0.3,1) forwards", animationDelay: `${0.02 + i * 0.05}s` }}>
                      <PostCard post={post} onLike={handleLike} />
                    </div>
                  ))
                : <EmptyFeed hasSearch={search.trim().length > 0} />}
            </div>
          </div>

          {/* ── SIDEBAR ── */}
          <div style={{ minWidth: 0 }}>
            <MarketPulse />
            <KnowledgeCenter />
            <Leaderboard />
            <QuickActionsSidebar />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dReveal { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dRipple { 0%{transform:scale(0.7);opacity:0.5} 100%{transform:scale(2.4);opacity:0} }
        @keyframes dFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        input::placeholder { color: #94A3B8; }
        select option      { background: #fff; color: #0F172A; }
        .hub-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 270px;
          gap: 14px;
          align-items: start;
        }
        @media (max-width: 760px) {
          .hub-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}