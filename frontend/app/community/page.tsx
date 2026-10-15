"use client";
import { useRef, useState } from "react";
import { useApp, type Key } from "../providers";
import { api, errKey, Icon, LoadError, useApi, type Answer, type Question } from "../ui";

const TAGS = ["all", "esim", "plans", "network", "general"];
const SPRING = "linear(0, .06 2%, .23 5%, .6 11%, .86 17%, 1.01 23%, 1.07 28%, 1.08 32%, 1.05 40%, 1.01 50%, .995 60%, 1)";
// Apple's resting-point projection (Designing Fluid Interfaces): px/s -> px travelled, decay .998
const project = (v: number) => ((v / 1000) * 0.998) / (1 - 0.998);
// soft edge: the further past the bound, the less the sheet follows
const rubberband = (x: number, dim: number, c = 0.55) => (x * dim * c) / (dim + c * Math.abs(x));
const ty = (el: Element) => new DOMMatrix(getComputedStyle(el).transform).m42; // on-screen value

/** Bottom sheet that tracks the finger 1:1, can be grabbed mid-flight, and dismisses on a flick. */
function useSheet() {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ start: number; y: number; t: number; v: number } | null>(null);

  const close = (v = 0) => {
    const el = ref.current;
    if (!el?.open) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return el.close();
    const sheet = matchMedia("(max-width: 760px)").matches;
    const from = ty(el), rest = el.offsetHeight - from;
    el.getAnimations().forEach((a) => a.cancel());
    el.style.transform = "";
    // leave the way it came in, and keep the finger's speed if there was a flick
    el.animate(sheet
      ? [{ transform: `translateY(${from}px)` }, { transform: "translateY(100%)" }]
      : [{ opacity: 1 }, { opacity: 0, transform: "translateY(40px) scale(.96)" }],
    { duration: v > 0 ? Math.min(350, Math.max(140, (rest / v) * 1000)) : 280, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" })
      .finished.then(() => { el.close(); el.getAnimations().forEach((a) => a.cancel()); }, () => {}); // grabbed again: keep open
  };

  const down = (e: React.PointerEvent) => {
    const el = ref.current!;
    const y = ty(el); // grab where it is now, even mid-animation
    el.getAnimations().forEach((a) => a.cancel());
    el.style.transform = `translateY(${y}px)`;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { start: e.clientY - y, y, t: e.timeStamp, v: 0 };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const raw = e.clientY - d.start;
    const y = raw < 0 ? rubberband(raw, ref.current!.offsetHeight) : raw;
    const dt = e.timeStamp - d.t;
    if (dt > 0) d.v = 0.8 * ((y - d.y) / dt) * 1000 + 0.2 * d.v; // smoothed px/s
    d.y = y;
    d.t = e.timeStamp;
    ref.current!.style.transform = `translateY(${y}px)`;
  };
  const up = () => {
    const d = drag.current, el = ref.current!;
    drag.current = null;
    if (!d) return;
    if (d.y + project(d.v) > el.offsetHeight / 2) return close(d.v);
    el.style.transform = "";
    el.animate([{ transform: `translateY(${d.y}px)` }, { transform: "none" }], { duration: 450, easing: SPRING });
  };

  return { ref, close, grabber: { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up } };
}

function QItem({ q, onChange }: { q: Question; onChange: (q: Question) => void }) {
  const { t, tr, n, toast } = useApp();
  const [body, setBody] = useState("");
  const [voted, setVoted] = useState(false);
  const [busy, setBusy] = useState(false);

  const vote = (e: React.MouseEvent) => {
    e.preventDefault(); // don't toggle <details>
    if (voted) return;
    setVoted(true);
    onChange({ ...q, votes: q.votes + 1 }); // optimistic
    api(`/questions/${q.id}/vote`, {}).catch((err) => { setVoted(false); onChange(q); toast(t(errKey(err))); });
  };
  const send = async () => {
    if (body.trim().length < 3 || busy) return;
    setBusy(true);
    try {
      const r = await api<{ answer: Answer; earned: number }>(`/questions/${q.id}/answers`, { body });
      onChange({ ...q, answers: [...q.answers, r.answer] });
      setBody("");
      toast(r.earned ? `+${n(r.earned)} ${t("earned")}` : t("answered"));
    } catch (e) {
      toast(t(errKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="q glass">
      <summary>
        <button className={`vote ${voted ? "on" : ""}`} onClick={vote} aria-label={`${t("vote")} ${n(q.votes)}`} aria-pressed={voted}>
          <Icon name="up" size={16} />{n(q.votes)}
        </button>
        <div style={{ flex: 1 }}>
          <h2 dir="auto">{tr(q.title)}</h2>
          <div className="meta">
            <span className="tag">{t(`tag_${q.tag}` as Key) ?? q.tag}</span>
            <span>{n(q.answers.length)} {t("answers")}</span>
            {q.answers.some((a) => a.accepted) && <span className="badge-ok"><Icon name="check" size={14} />{t("accepted")}</span>}
          </div>
        </div>
      </summary>
      <div className="q-body">
        {q.answers.length === 0 && <p className="muted">{t("noAnswers")}</p>}
        {q.answers.map((a) => (
          <div key={a.id} className={`ans ${a.accepted ? "ok" : ""}`}>
            <div className="who">{tr(a.author)}{a.accepted && <span className="badge-ok"><Icon name="check" size={14} />{t("accepted")}</span>}</div>
            <p dir="auto">{tr(a.body)}</p>
          </div>
        ))}
        <div className="reply">
          <textarea className="input" rows={1} dir="auto" maxLength={2000} placeholder={t("yourAnswer")} aria-label={t("yourAnswer")}
            value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn" onClick={send} disabled={body.trim().length < 3 || busy}>{t("send")}</button>
        </div>
      </div>
    </details>
  );
}

export default function Community() {
  const { t, tr, toast } = useApp();
  const [qs, setQs, retry] = useApi<Question[]>("/questions");
  const [tag, setTag] = useState("all");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [newTag, setNewTag] = useState("general");
  const sheet = useSheet();

  const shown = (qs ?? []).filter((q) =>
    (tag === "all" || q.tag === tag) && tr(q.title).toLowerCase().includes(query.trim().toLowerCase()));
  const update = (q: Question) => setQs((all) => all && all.map((x) => (x.id === q.id ? q : x)));

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const q = await api<Question>("/questions", { title, tag: newTag });
      setQs((all) => [q, ...(all ?? [])]);
      setTitle("");
      sheet.close();
      toast(t("asked"));
    } catch (err) {
      toast(t(errKey(err)));
    }
  };

  return (
    <div className="wrap">
      <div className="page-head">
        <h1 className="rise">{t("comTitle")}</h1>
        <p className="rise">{t("comSub")}</p>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input className="input" type="search" placeholder={t("search")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("search")} />
        </div>
        <button className="btn" onClick={() => sheet.ref.current?.showModal()}><Icon name="plus" size={18} />{t("ask")}</button>
      </div>
      <div className="chips">
        {TAGS.map((x) => (
          <button key={x} aria-pressed={tag === x} onClick={() => setTag(x)}>{t(x === "all" ? "all" : (`tag_${x}` as Key))}</button>
        ))}
      </div>
      <div className="qlist">
        {!qs && (retry ? <LoadError retry={retry} /> : [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ minHeight: 84 }} />))}
        {qs && shown.length === 0 && <div className="empty">{t("noResults")}</div>}
        {shown.map((q) => <QItem key={q.id} q={q} onChange={update} />)}
      </div>

      <dialog ref={sheet.ref} aria-labelledby="ask-title" onCancel={(e) => { e.preventDefault(); sheet.close(); }}
        onClick={(e) => e.target === sheet.ref.current && sheet.close()}>
        <div className="grabber" aria-hidden="true" {...sheet.grabber} />
        <form onSubmit={ask} className="stack">
          <h2 id="ask-title" style={{ fontSize: "1.5rem" }}>{t("askT")}</h2>
          <textarea className="input" required minLength={5} maxLength={200} dir="auto" placeholder={t("askPh")} aria-label={t("askT")}
            value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <div className="chips" style={{ margin: 0 }}>
            {TAGS.slice(1).map((x) => (
              <button type="button" key={x} aria-pressed={newTag === x} onClick={() => setNewTag(x)}>{t(`tag_${x}` as Key)}</button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={() => sheet.close()}>{t("cancel")}</button>
            <button className="btn" disabled={title.trim().length < 5}>{t("post")}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
