"use client";
import { useState } from "react";
import { useApp, type Key } from "../providers";
import { api, Counter, errKey, Icon, LoadError, useApi, type Member, type Plan, type Stats } from "../ui";

function Ring({ used, total, label, color }: { used: number; total: number; label: string; color: string }) {
  const { n, t } = useApp();
  const C = 2 * Math.PI * 52;
  const p = Math.min(1, used / total);
  return (
    <div className="ring">
      <div className="ring-box">
        <svg viewBox="0 0 120 120">
          <circle className="track" cx="60" cy="60" r="52" />
          <circle className="bar" cx="60" cy="60" r="52" stroke={color} strokeDasharray={C} strokeDashoffset={C * (1 - p)}
            style={{ "--c": C } as React.CSSProperties} />
        </svg>
        <b>{n(Math.round(p * 100))}{t("pct")}</b>
      </div>
      <small>{n(used, 1)} {t("of")} {n(total)}<br />{label}</small>
    </div>
  );
}

const KINDS = ["topup", "cash", "charity"] as const;

export default function Dashboard() {
  const { t, tr, n, toast } = useApp();
  const [me, setMe, retry] = useApi<Member>("/me");
  const [plans] = useApi<Plan[]>("/plans");
  const [stats] = useApi<Stats>("/stats");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("topup");
  const [pts, setPts] = useState(500);
  const [charity, setCharity] = useState("mahak");
  const [copied, setCopied] = useState(false);

  if (retry) return <div className="wrap"><div className="page-head" /><LoadError retry={retry} /></div>;
  if (!me) return <div className="wrap"><div className="page-head" /><div className="dash">{[8, 4, 6, 6].map((s, i) => <div key={i} className={`skeleton s${s}`} />)}</div></div>;

  const plan = plans?.find((p) => p.id === me.plan);
  const max = Math.max(50, me.points);
  const amount = Math.min(pts, me.points);

  const redeem = async () => {
    try {
      setMe(await api<Member>("/redeem", { kind, points: amount, charity: kind === "charity" ? charity : null }));
      toast(kind === "cash" ? t("cashReq") : `${t("redeemed")} — ${n(amount * 100)} ${t("toman")}`);
    } catch (e) {
      toast(t((e as { status?: number }).status === 400 ? "notEnough" : errKey(e)));
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(me.referral); // undefined on plain-http origins: report it, don't fake it
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast(t("copyFail"));
    }
  };

  return (
    <div className="wrap">
      <div className="page-head">
        <h1 className="rise">{t("hello")} {tr(me.name)} <span className="grad-text">👋</span></h1>
        <p className="rise">{plan && t(plan.id)} · <span dir="ltr">{me.phone}</span> · {n(me.renews_in)} {t("renews")}</p>
      </div>

      <div className="dash">
        <div className="card glass s8 rise">
          <h2>{t("usage")}</h2>
          {plan && (
            <div className="rings">
              <Ring used={me.usage.data} total={plan.data} label={t("gb")} color="var(--a1)" />
              <Ring used={me.usage.minutes} total={plan.minutes} label={t("min")} color="var(--a2)" />
              <Ring used={me.usage.sms} total={plan.sms} label={t("sms")} color="var(--a3)" />
            </div>
          )}
        </div>

        <div className="card glass rise">
          <div className="squircle"><Icon name="wallet" size={24} /></div>
          <p className="muted" style={{ marginTop: 16 }}>{t("credit")}</p>
          <div className="kpi" key={me.credit}><Counter to={me.credit} /> <small style={{ fontSize: "1rem" }}>{t("toman")}</small></div>
          <p className="muted" style={{ marginTop: 18 }}>{t("points")}</p>
          <div className="kpi grad-text" key={me.points}><Counter to={me.points} /></div>
          <p className="muted">{t("worth")}: {n(me.points * 100)} {t("toman")}</p>
          {me.cash_pending > 0 && <p className="muted">{t("cashPending")}: {n(me.cash_pending)} {t("toman")}</p>}
        </div>

        <div className="card glass s6 rise">
          <h2>{t("redeem")}</h2>
          <div className="seg" style={{ "--i": KINDS.indexOf(kind) } as React.CSSProperties}>
            <span className="thumb" />
            {KINDS.map((k) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{t(k)}</button>)}
          </div>
          {kind === "charity" && (
            <select className="input" value={charity} onChange={(e) => setCharity(e.target.value)} aria-label={t("charity")} style={{ marginBottom: 12 }}>
              {(stats?.charities ?? []).map((c) => <option key={c.id} value={c.id}>{t(c.id)}</option>)}
            </select>
          )}
          <label className="muted" htmlFor="pts">{t("amount")}</label>
          <input id="pts" className="range" type="range" min={50} max={max} step={50} value={amount} onChange={(e) => setPts(+e.target.value)}
            style={{ "--p": `${((amount - 50) / Math.max(1, max - 50)) * 100}%`, margin: "18px 0" } as React.CSSProperties} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div><b style={{ fontSize: "1.4rem" }}>{n(amount)}</b> <span className="muted">{t("points")} = {n(amount * 100)} {t("toman")}</span></div>
            <button className="btn" onClick={redeem} disabled={me.points < 50}>{t("confirm")}</button>
          </div>
        </div>

        <div className="card glass s6 rise">
          <h2>{t("invite")}</h2>
          <p className="muted" style={{ marginTop: 6 }}>{t("inviteSub")}</p>
          <div className="code">
            <span>{me.referral}</span>
            <button className="btn btn-sm btn-ghost" onClick={copy}><Icon name={copied ? "check" : "copy"} size={16} />{t(copied ? "copied" : "copy")}</button>
          </div>
          <h3 style={{ marginTop: 24, fontSize: "1.05rem" }}>{t("earn")}</h3>
          <ul className="earn">
            {Object.entries(stats?.points ?? {}).map(([k, v]) => (
              <li key={k}><span>{t(`e_${k}` as Key)}</span><b>+{n(v)}</b></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
