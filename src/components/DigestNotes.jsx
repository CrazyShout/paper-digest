import { useEffect, useMemo, useState } from "react";

const LOCAL_NOTES_KEY = "paper-digest-local-notes";
const IDENTITY_KEY = "paper-digest-anon-identity";

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "") || fallback;
  } catch {
    return fallback;
  }
}

function identity() {
  const stored = readJson(IDENTITY_KEY, null);
  if (stored?.nickname) return stored;
  const created = {
    nickname: `匿名读者-${Math.floor(1000 + Math.random() * 9000)}`
  };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(created));
  return created;
}

function displayTime(note) {
  if (note.time) return note.time;
  if (!note.createdAt) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(note.createdAt));
}

export default function DigestNotes({
  digestId,
  issueLabel,
  seedNotes = [],
  commentsEndpoint = ""
}) {
  const endpoint = String(commentsEndpoint || "").replace(/\/$/, "");
  const [remoteNotes, setRemoteNotes] = useState([]);
  const [localNotes, setLocalNotes] = useState([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const notes = readJson(LOCAL_NOTES_KEY, {});
    setLocalNotes(notes[digestId] || []);

    if (!endpoint) return;
    const controller = new AbortController();
    fetch(`${endpoint}?digestId=${encodeURIComponent(digestId)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => setRemoteNotes(Array.isArray(data.comments) ? data.comments : []))
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("暂时无法读取共享评论。");
      });
    return () => controller.abort();
  }, [digestId, endpoint]);

  const notes = useMemo(() => [
    ...seedNotes.map((note) => ({
      id: `${note.user}-${note.time}-${note.text}`,
      nickname: String(note.user || "编辑").replace(/^@/, ""),
      time: note.time,
      text: note.text
    })),
    ...remoteNotes,
    ...localNotes
  ], [localNotes, remoteNotes, seedNotes]);

  function persistLocal(note) {
    const all = readJson(LOCAL_NOTES_KEY, {});
    all[digestId] = [...(all[digestId] || []), note];
    localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(all));
    setLocalNotes(all[digestId]);
  }

  async function submit(event) {
    event.preventDefault();
    const content = text.trim();
    if (!content || submitting) return;

    const note = {
      digestId,
      nickname: identity().nickname,
      createdAt: new Date().toISOString(),
      text: content
    };
    setSubmitting(true);
    setStatus("");

    try {
      if (!endpoint) throw new Error("local-only");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(note)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setRemoteNotes((current) => [...current, data.comment || note]);
      setStatus("评论已同步。");
    } catch {
      persistLocal({
        ...note,
        id: `local-${Date.now()}`
      });
      setStatus(endpoint ? "同步失败，已保存在本机。" : "评论已保存在本机。");
    } finally {
      setText("");
      setSubmitting(false);
    }
  }

  return (
    <section className="digest-comments" id="discussion" aria-labelledby="discussion-title">
      <header>
        <p className="doc-eyebrow">Discussion · {issueLabel}</p>
        <h2 id="discussion-title">阅读讨论</h2>
        <p>{endpoint ? "评论会同步到共享仓库。" : "尚未配置评论服务，内容只保存在当前浏览器。"}</p>
      </header>

      <div className="digest-comment-list">
        {notes.length ? notes.map((note) => (
          <article key={note.id || `${note.nickname}-${note.createdAt}-${note.text}`}>
            <div>
              <strong>{note.nickname || "匿名同学"}</strong>
              <span>{displayTime(note)}</span>
            </div>
            <p>{note.text}</p>
          </article>
        )) : <p className="digest-comments-empty">还没有讨论。</p>}
      </div>

      <form onSubmit={submit}>
        <label htmlFor={`digest-note-${digestId}`}>添加评论</label>
        <textarea
          id={`digest-note-${digestId}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={1200}
          rows={4}
          placeholder="记录疑问、复现线索或组会讨论点"
          required
        />
        <div>
          <span role="status" aria-live="polite">{status}</span>
          <button type="submit" disabled={submitting}>
            {submitting ? "提交中" : "提交评论"}
          </button>
        </div>
      </form>
    </section>
  );
}
