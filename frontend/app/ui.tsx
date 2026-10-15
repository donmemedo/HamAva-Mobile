"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp, type Key, type L } from "./providers";

export type Plan = { id: "basic" | "plus" | "max"; price: number; data: number; minutes: number; sms: number; tag: Key };
export type Answer = { id: number; author: L; body: L; accepted: boolean };
export type Question = { id: number; title: L; tag: string; votes: number; answers: Answer[] };
export type Member = {
  name: L; phone: string; plan: Plan["id"]; points: number; credit: number; cash_pending: number; referral: string;
  usage: { data: number; minutes: number; sms: number }; renews_in: number;
};
export type Stats = {
  members: number; answered: number; avg_minutes: number; donated: number;
  charities: { id: "mahak" | "school" | "forest"; raised: number }[]; points: Record<string, number>;
};

export async function api<T>(path: string, body?: unknown): Promise<T> {
  // GETs use the browser cache as the API's Cache-Control allows (plans/stats cache, member data never)
  const r = await fetch(`/api${path}`, body === undefined ? undefined : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) {
    const d = (await r.json().catch(() => ({}))).detail; // string, or a list of 422 issues
    throw Object.assign(new Error(typeof d === "string" ? d : d?.[0]?.msg ?? r.statusText), { status: r.status });
  }
  return r.json();
}

/** Message key for a failed request. */
export const errKey = (e: unknown): Key =>
  ({ 429: "slow", 409: "full" } as Record<number, Key>)[(e as { status?: number })?.status ?? 0] ?? "err";

/** [data, setData, retry]; retry is non-null only after a failed load. */
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setFailed(false);
    api<T>(path).then(setData).catch(() => setFailed(true));
  }, [path, attempt]);
  return [data, setData, failed ? () => setAttempt((a) => a + 1) : null] as const;
}

export function LoadError({ retry }: { retry: () => void }) {
  const { t } = useApp();
  return (
    <div className="empty" role="alert">
      <p>{t("loadErr")}</p>
      <button className="btn btn-sm btn-ghost" onClick={retry}>{t("retry")}</button>
    </div>
  );
}

/** Counts up from 0 when scrolled into view. */
export function Counter({ to, digits = 0 }: { to: number; digits?: number }) {
  const { n } = useApp();
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setV(to);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1400);
        setV(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref}>{n(v, digits)}</span>;
}

const paths = {
  home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  grid: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  sim: "M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 12h6v6H9z",
  gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7C10 3 6 4 7.5 7M12 7c2-4 6-3 4.5 0",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  check: "M5 12l5 5L20 7",
  arrow: "M5 12h14M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  heart: "M12 20s-7-4.5-9.3-8.8A5.3 5.3 0 0 1 12 6a5.3 5.3 0 0 1 9.3 5.2C19 15.5 12 20 12 20z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
  up: "M12 19V5M6 11l6-6 6 6",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7M22 21a7 7 0 0 0-4-6.3",
  wallet: "M3 7h18v13H3zM3 7l3-4h12l3 4M16 13.5h2",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18",
};
export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function Logo() {
  const { t } = useApp();
  return (
    <Link href="/" className="logo" aria-label={t("brand")}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--a1)" /><stop offset=".55" stopColor="var(--a2)" /><stop offset="1" stopColor="var(--a3)" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#lg)" />
        <circle cx="12.5" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.4" />
        <circle cx="19.5" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.4" opacity=".75" />
      </svg>
      <span>{t("brand")}</span>
    </Link>
  );
}

const tabs: { href: string; key: Key; icon: IconName }[] = [
  { href: "/", key: "home", icon: "home" },
  { href: "/community", key: "community", icon: "chat" },
  { href: "/dashboard", key: "dashboard", icon: "grid" },
  { href: "/join", key: "join", icon: "sim" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { t, toggleLang, toggleTheme } = useApp();
  const path = usePathname();
  return (
    <>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <header className="nav chrome">
        <div className="wrap nav-in">
          <Logo />
          <nav className="nav-links" aria-label={t("mainNav")}>
            {tabs.slice(0, 3).map((x) => (
              <Link key={x.href} href={x.href} className={path === x.href ? "on" : ""}
                aria-current={path === x.href ? "page" : undefined}>{t(x.key)}</Link>
            ))}
          </nav>
          <div className="nav-tools">
            <button className="icon-btn" onClick={toggleLang} aria-label={t("lang")}>
              <Icon name="globe" size={18} /><span className="lang-lbl">{t("lang")}</span>
            </button>
            <button className="icon-btn" onClick={toggleTheme} aria-label={t("theme")}>
              <Icon name="sun" size={18} className="i-sun" /><Icon name="moon" size={18} className="i-moon" />
            </button>
            <Link href="/join" className="btn btn-sm nav-cta">{t("join")}</Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="wrap footer">
        <Logo />
        <p>{t("footer")}</p>
      </footer>
      <nav className="tabbar chrome" aria-label={t("mainNav")}>
        {tabs.map((x) => (
          <Link key={x.href} href={x.href} className={path === x.href ? "on" : ""}
            aria-current={path === x.href ? "page" : undefined}>
            <Icon name={x.icon} size={22} /><span>{t(x.key)}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
