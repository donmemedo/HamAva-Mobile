"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp, type Key } from "../providers";
import { api, errKey, Icon, useApi, type Plan } from "../ui";

const steps: Key[] = ["stepPlan", "stepInfo", "stepOk"];
const PHONE = /^(\+98|0098|0|۰)?[9۹][0-9۰-۹]{9}$/; // the API re-checks and canonicalizes
const PLAN_IDS = ["basic", "plus", "max"];

function Confetti() {
  const colors = ["var(--a1)", "var(--a2)", "var(--a3)", "var(--ok)", "#facc15"];
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <i key={i} style={{
          left: `${(i * 37) % 100}%`, background: colors[i % 5], animationDelay: `${(i % 6) * 0.05}s`,
          "--x": `${((i * 53) % 120) - 60}px`, "--r": `${(i * 97) % 720}deg`,
        } as React.CSSProperties} />
      ))}
    </div>
  );
}

export default function Join() {
  const { t, n, toast } = useApp();
  const [plans] = useApi<Plan[]>("/plans");
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ plan: "plus", name: "", phone: "", city: "", esim: false });
  const [touched, setTouched] = useState<Record<string, boolean>>({}); // validate a field once it's left
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(location.search).get("plan");
    if (p && PLAN_IDS.includes(p)) setF((x) => ({ ...x, plan: p }));
  }, []);

  const phone = f.phone.replace(/[\s-]/g, "");
  const errs = {
    name: f.name.trim().length < 2 ? t("empty") : "",
    phone: !phone ? t("empty") : PHONE.test(phone) ? "" : t("phoneErr"),
    city: f.city.trim().length < 2 ? t("empty") : "",
  };
  const valid = !errs.name && !errs.phone && !errs.city;
  const plan = plans?.find((p) => p.id === f.plan);

  const next = () => {
    if (step === 1 && !valid) return setTouched({ name: true, phone: true, city: true });
    setStep((s) => s + 1);
  };
  const submit = async () => {
    setBusy(true);
    try {
      await api("/orders", { ...f, phone });
      setDone(true);
    } catch (e) {
      toast(t(errKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const field = (k: "name" | "phone" | "city", type = "text", auto = "") => (
    <div className="field">
      <label htmlFor={k}>{t(k)}</label>
      <input id={k} className="input" type={type} autoComplete={auto} value={f[k]} inputMode={k === "phone" ? "tel" : undefined}
        dir={k === "phone" ? "ltr" : "auto"} aria-invalid={!!touched[k] && !!errs[k]} aria-describedby={`${k}-err`}
        onChange={(e) => setF({ ...f, [k]: e.target.value })} onBlur={() => setTouched((x) => ({ ...x, [k]: true }))} />
      <span className="err" id={`${k}-err`} aria-live="polite">{touched[k] && errs[k]}</span>
    </div>
  );

  return (
    <div className="wrap">
      <div className="page-head center" style={{ textAlign: "center" }}><h1 className="rise">{t("joinT")}</h1></div>
      <div className="card glass join-card">
        {done ? (
          <div className="success">
            <Confetti />
            <div className="tick"><Icon name="check" size={48} /></div>
            <h2 style={{ fontSize: "2rem" }}>{t("done")}</h2>
            <p className="muted" style={{ margin: "12px 0 28px" }}>{f.esim ? t("doneEsim") : t("doneSub")}</p>
            <Link href="/dashboard" className="btn">{t("toDash")}<Icon name="arrow" size={18} className="flip" /></Link>
          </div>
        ) : (
          <>
            <div className="steps">{steps.map((s, i) => <div key={s} className={i <= step ? "on" : ""}><i /></div>)}</div>
            <div className="step-lbl">{steps.map((s, i) => <span key={s} className={i <= step ? "on" : ""}>{t(s)}</span>)}</div>

            <div key={step} className="slide-in">
              {step === 0 && (
                <div className="radio-plan" role="radiogroup">
                  {(plans ?? []).map((p) => (
                    <label key={p.id}>
                      <input type="radio" name="plan" checked={f.plan === p.id} onChange={() => setF({ ...f, plan: p.id })} />
                      <span>
                        <b>{t(p.id)}</b>
                        <div className="muted" style={{ fontSize: ".85rem" }}>{n(p.data)} {t("gb")} · {n(p.minutes)} {t("min")}</div>
                      </span>
                      <span className="rp-price">{n(p.price)} <small className="muted">{t("k")}</small></span>
                    </label>
                  ))}
                  {!plans && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ minHeight: 76, borderRadius: 20 }} />)}
                </div>
              )}
              {step === 1 && (
                <div className="stack">
                  {field("name", "text", "name")}
                  {field("phone", "tel", "tel")}
                  {field("city", "text", "address-level2")}
                  <label className="switch">
                    <input type="checkbox" checked={f.esim} onChange={(e) => setF({ ...f, esim: e.target.checked })} />
                    <span><b>{t("esim")}</b><div className="muted" style={{ fontSize: ".85rem" }}>{t("esimD")}</div></span>
                  </label>
                </div>
              )}
              {step === 2 && (
                <div className="summary">
                  <h2 style={{ marginBottom: 6, fontSize: "1.17rem" }}>{t("review")}</h2>
                  <div><span className="muted">{t("stepPlan")}</span><b>{plan && t(plan.id)}</b></div>
                  <div><span className="muted">{t("name")}</span><b>{f.name}</b></div>
                  <div><span className="muted">{t("phone")}</span><b dir="ltr">{f.phone}</b></div>
                  <div><span className="muted">{t("city")}</span><b>{f.city}</b></div>
                  <div><span className="muted">{f.esim ? "eSIM" : t("simCard")} + {t("shipping")}</span><b style={{ color: "var(--ok)" }}>{t("free")}</b></div>
                  <div><span className="muted">{t("monthly")}</span><b>{plan && `${n(plan.price)} ${t("k")}`}</b></div>
                </div>
              )}
            </div>

            <div className="row">
              {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>{t("back")}</button>}
              {step < 2
                ? <button className="btn" onClick={next}>{t("next")}</button>
                : <button className="btn" onClick={submit} disabled={busy}>{t("submit")}</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
