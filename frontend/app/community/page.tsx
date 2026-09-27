"use client";
import { useRef, useState } from "react";
import { useApp, type Key } from "../providers";
import { api, Icon, useApi, type Answer, type Question } from "../ui";

const TAGS = ["all", "esim", "plans", "network", "general"];

function QItem({ q, onChange }: { q: Question; onChange: (q: Question) => void }) {
  const { t, tr, n, toast } = useApp();
  const [body, setBody] = useState("");
  const [voted, setVoted] = useState(false);

  const vote = (e: React.MouseEvent) => {
    e.preventDefault(); // don't toggle <details>
    if (voted) return;
    setVoted(true);
    onChange({ ...q, votes: q.votes + 1 }); // optimistic
    api(`/questions/${q.id}/vote`, {}).catch(() => { setVoted(false); onChange(q); });
  };
  const send = async () => {
    if (body.trim().length < 3) return;
    try {
      const r = await api<{ answer: Answer; earned: number }>(`/questions/${q.id}/answers`, { body });
      onChange({ ...q, answers: [...q.answers, r.answer] });
      setBody("");
      toast(`+${n(r.earned)} ${t("earned")}`);
    } catch {
      toast(t("err"));
    }
  };

  return (
    <details className="q glass reveal">
      <summary>
        <button className={`vote ${voted ? "on" : ""}`} onClick={vote} aria-label="vote" aria-pressed={voted}>
          <Icon name="up" size={16} />{n(q.votes)}
        </button>
        <div style={{ flex: 1 }}>
          <h3>{tr(q.title)}</h3>
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
            <p>{tr(a.body)}</p>
          </div>
        ))}
        <div className="reply">
          <textarea className="input" rows={1} placeholder={t("yourAnswer")} value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn" onClick={send} disabled={body.trim().length < 3}>{t("send")}</button>
        </div>
      </div>
    </details>
  );
}

export default function Community() {
  const { t, tr, toast } = useApp();
  const [qs, setQs] = useApi<Question[]>("/questions");
  const [tag, setTag] = useState("all");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [newTag, setNewTag] = useState("general");
  const dlg = useRef<HTMLDialogElement>(null);

  const shown = (qs ?? []).filter((q) =>
    (tag === "all" || q.tag === tag) && tr(q.title).toLowerCase().includes(query.trim().toLowerCase()));
  const update = (q: Question) => setQs((all) => all && all.map((x) => (x.id === q.id ? q : x)));

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const q = await api<Question>("/questions", { title, tag: newTag });
      setQs((all) => [q, ...(all ?? [])]);
      setTitle("");
      dlg.current?.close();
      toast(t("asked"));
    } catch {
      toast(t("err"));
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
        <button className="btn" onClick={() => dlg.current?.showModal()}><Icon name="plus" size={18} />{t("ask")}</button>
      </div>
      <div className="chips">
        {TAGS.map((x) => (
          <button key={x} aria-pressed={tag === x} onClick={() => setTag(x)}>{t(x === "all" ? "all" : (`tag_${x}` as Key))}</button>
        ))}
      </div>
      <div className="qlist">
        {!qs && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ minHeight: 84 }} />)}
        {qs && shown.length === 0 && <div className="empty">{t("noResults")}</div>}
        {shown.map((q) => <QItem key={q.id} q={q} onChange={update} />)}
      </div>

      <dialog ref={dlg} onClick={(e) => e.target === dlg.current && dlg.current.close()}>
        <form onSubmit={ask} className="stack">
          <h2 style={{ fontSize: "1.5rem" }}>{t("askT")}</h2>
          <textarea className="input" required minLength={5} maxLength={200} placeholder={t("askPh")} value={title}
            onChange={(e) => setTitle(e.target.value)} autoFocus />
          <div className="chips" style={{ margin: 0 }}>
            {TAGS.slice(1).map((x) => (
              <button type="button" key={x} aria-pressed={newTag === x} onClick={() => setNewTag(x)}>{t(`tag_${x}` as Key)}</button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={() => dlg.current?.close()}>{t("cancel")}</button>
            <button className="btn" disabled={title.trim().length < 5}>{t("post")}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
