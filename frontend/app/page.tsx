"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useApp } from "./providers";
import { Counter, Icon, LoadError, useApi, type Plan, type Stats } from "./ui";

function SimCard() {
  const { t, n } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  // 1:1 tracking while the pointer is over the stage, spring back on leave
  const move = (e: React.PointerEvent) => {
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.dataset.live = "";
    el.style.setProperty("--rx", `${-y * 22}deg`);
    el.style.setProperty("--ry", `${x * 26}deg`);
    el.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--my", `${(y + 0.5) * 100}%`);
  };
  const leave = () => {
    const el = ref.current!;
    delete el.dataset.live;
    ["--rx", "--ry", "--mx", "--my"].forEach((p) => el.style.removeProperty(p));
  };
  return (
    <div className="sim-stage rise" onPointerMove={move} onPointerLeave={leave} onPointerCancel={leave}>
      <div ref={ref} className="sim">
        <div className="sim-top">{t("brand")}<small>eSIM · 5G</small></div>
        <div className="chip" />
        <div className="sim-num">0990 •••• 2026</div>
      </div>
      <div className="float-chip chrome fc1"><span className="ic"><Icon name="bolt" size={18} /></span><span><b>+{n(50)}</b> {t("chipPts")}</span></div>
      <div className="float-chip chrome fc2"><span className="ic"><Icon name="chat" size={18} /></span><span><b>{n(7)}</b> {t("chipMin")}</span></div>
      <div className="float-chip chrome fc3"><span className="ic"><Icon name="check" size={18} /></span><span><b>{n(0)}</b> {t("chipZero")}</span></div>
    </div>
  );
}

function Calculator() {
  const { t, n } = useApp();
  const [a, setA] = useState(12);
  const save = a * 50 * 100; // 50 points per answer, 1 point = 100 toman
  const price = 189_000;
  const pct = Math.min(100, (save / price) * 100);
  return (
    <div className="card glass calc reveal">
      <div>
        <h2>{t("calcT")}</h2>
        <p className="muted" style={{ marginTop: 12 }}>{t("calcQ")}</p>
        <input className="range" type="range" min={0} max={60} value={a} aria-label={t("calcQ")}
          onChange={(e) => setA(+e.target.value)} style={{ "--p": `${(a / 60) * 100}%` } as React.CSSProperties} />
        <div className="muted" style={{ fontWeight: 700 }}>{n(a)} {t("answers")}</div>
      </div>
      <div>
        <div className="muted">{t("calcSave")}</div>
        <div className="savings grad-text">{n(save)} <small style={{ fontSize: "1.2rem" }}>{t("toman")}</small></div>
        <div className="meter"><i style={{ width: `${pct}%` }} /></div>
        {pct >= 100 ? <div className="win" key="w">{t("calcFree")}</div> : <div className="muted">{n(pct)}{t("pct")} {t("calcOf")}</div>}
      </div>
    </div>
  );
}

function PlanCards() {
  const { t, n } = useApp();
  const [plans, , retry] = useApi<Plan[]>("/plans");
  if (retry) return <LoadError retry={retry} />;
  if (!plans) return <div className="plans">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ minHeight: 420 }} />)}</div>;
  return (
    <div className="plans">
      {plans.map((p) => (
        <article key={p.id} className={`card glass plan reveal ${p.tag === "popular" ? "hot" : ""}`}>
          <span className="tag">{t(p.tag)}</span>
          <h3 style={{ fontSize: "1.4rem" }}>{t(p.id)}</h3>
          <div className="price"><strong>{n(p.price)}</strong><span className="muted">{t("k")} {t("perMonth")}</span></div>
          <ul className="feat">
            <li><Icon name="check" size={18} />{n(p.data)} {t("gb")}</li>
            <li><Icon name="check" size={18} />{n(p.minutes)} {t("min")}</li>
            <li><Icon name="check" size={18} />{n(p.sms)} {t("sms")}</li>
          </ul>
          <Link href={`/join?plan=${p.id}`} className={`btn btn-block ${p.tag === "popular" ? "" : "btn-ghost"}`}>{t("choose")}</Link>
        </article>
      ))}
    </div>
  );
}

export default function Home() {
  const { t, n } = useApp();
  const [stats, , retryStats] = useApi<Stats>("/stats");
  return (
    <>
      <div className="wrap hero">
        <div>
          <span className="eyebrow rise"><b>MVNO</b>{t("eyebrow")}</span>
          <h1 className="rise"><span>{t("h1a")}</span><span className="grad-text">{t("h1b")}</span></h1>
          <p className="lead rise">{t("heroSub")}</p>
          <div className="hero-cta rise">
            <Link href="/join" className="btn">{t("cta")}<Icon name="arrow" size={18} className="flip" /></Link>
            <a href="#plans" className="btn btn-ghost">{t("cta2")}</a>
          </div>
        </div>
        <SimCard />
      </div>

      <section className="wrap" style={{ paddingTop: 20 }}>
        <div className="stats">
          {([
            [stats?.members ?? 212480, "sMembers", 0],
            [stats?.answered ?? 96.4, "sAnswered", 1],
            [stats?.avg_minutes ?? 7, "sAvg", 0],
            [stats?.donated ?? 34270000, "sDonated", 0],
          ] as const).map(([v, k, d]) => (
            <div key={k} className="stat glass reveal"><strong className="grad-text"><Counter to={v} digits={d} /></strong><span>{t(k)}</span></div>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="sec-head reveal"><h2>{t("howT")} <span className="grad-text">{t("howT2")}</span></h2></div>
        <div className="bento">
          <div className="card glass wide reveal">
            <div className="squircle"><Icon name="users" size={26} /></div>
            <h3>{t("comT")}</h3><p className="muted">{t("comD")}</p>
            <div className="bubbles">
              <div className="bubble">{t("bubble1")}</div>
              <div className="bubble me">{t("bubble2")}<span className="pts">+{n(50)}</span></div>
            </div>
          </div>
          <div className="card glass reveal">
            <div className="squircle"><Icon name="sim" size={26} /></div>
            <h3>{t("simT")}</h3><p className="muted">{t("simD")}</p>
            <div className="big-free grad-text">{n(0)} {t("toman")}</div>
          </div>
          <div className="card glass reveal" style={{ gridColumn: "1 / -1", minHeight: 0 }}>
            <div className="squircle"><Icon name="gift" size={26} /></div>
            <h3>{t("rewT")}</h3><p className="muted">{t("rewD")}</p>
            <div className="pills">
              <span className="pill"><Icon name="bolt" size={16} />{t("topup")}</span>
              <span className="pill"><Icon name="wallet" size={16} />{t("cash")}</span>
              <span className="pill"><Icon name="heart" size={16} />{t("charity")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap" id="plans">
        <div className="sec-head center reveal"><h2>{t("plansT")}</h2><p>{t("plansSub")}</p></div>
        <PlanCards />
      </section>

      <section className="wrap"><Calculator /></section>

      <section className="wrap">
        <div className="sec-head reveal"><h2>{t("charT")}</h2><p>{t("charSub")}</p></div>
        {retryStats && <LoadError retry={retryStats} />}
        <div className="charities">
          {(stats?.charities ?? []).map((c) => (
            <div key={c.id} className="charity glass reveal">
              <span className="ic"><Icon name="heart" size={20} /></span>
              <b>{t(c.id)}</b>
              <span className="muted">{n(c.raised)} {t("toman")}</span>
              <div className="meter"><i style={{ width: `${Math.min(100, (c.raised / 25_000_000) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="cta reveal">
          <h2>{t("ctaT")}</h2><p>{t("ctaSub")}</p>
          <Link href="/join" className="btn">{t("cta")}<Icon name="arrow" size={18} className="flip" /></Link>
        </div>
      </section>
    </>
  );
}
