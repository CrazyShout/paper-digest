const DIGESTS = window.PAPER_DIGESTS || [];
const RUNTIME = window.PAPER_DIGEST_RUNTIME || {};
const LOCAL_NOTES_KEY = "paper-digest-local-notes";
const ANON_IDENTITY_KEY = "paper-digest-anon-identity";
const NAV_COLLAPSED_KEY = "paper-digest-nav-collapsed";
const COMMENTS_ENDPOINT = (RUNTIME.commentsEndpoint || "").replace(/\/$/, "");

function getDigestsByDate() {
  return DIGESTS.slice().sort((a, b) => b.date.localeCompare(a.date));
}

const state = {
  activeDigestId: getDigestsByDate()[0]?.id || "",
  query: "",
  identity: null,
  remoteNotes: {},
  remoteLoading: false
};

const els = {
  siteShell: document.querySelector(".site-shell"),
  navToggle: document.getElementById("navToggle"),
  digestList: document.getElementById("digestList"),
  activeDate: document.getElementById("activeDate"),
  activeTitle: document.getElementById("activeTitle"),
  paperSearch: document.getElementById("paperSearch"),
  searchResults: document.getElementById("searchResults"),
  digestArticle: document.getElementById("digestArticle"),
  notesToggle: document.getElementById("notesToggle"),
  notesDrawer: document.getElementById("notesDrawer"),
  closeNotes: document.getElementById("closeNotes"),
  notesIssue: document.getElementById("notesIssue"),
  noteStream: document.getElementById("noteStream"),
  noteComposer: document.getElementById("noteComposer"),
  anonAvatar: document.getElementById("anonAvatar"),
  anonName: document.getElementById("anonName"),
  shuffleIdentity: document.getElementById("shuffleIdentity"),
  noteText: document.getElementById("noteText"),
  saveNote: document.getElementById("saveNote"),
  noteHint: document.getElementById("noteHint")
};

function getActiveDigest() {
  return DIGESTS.find((digest) => digest.id === state.activeDigestId) || getDigestsByDate()[0];
}

function tagById(digest, tagId) {
  return digest.tags.find((tag) => tag.id === tagId) || { id: tagId, label: tagId, color: "#2f6f8f" };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomIdentity() {
  const colors = ["#2f6f8f", "#3f7d58", "#6a668f", "#b66a3c", "#a33f4a", "#526274"];
  const moods = ["认真", "困困", "敏锐", "安静", "好奇", "清醒", "准时", "稳重"];
  const names = ["小猫", "小狗", "论文猫", "读论文狗", "陶土猫", "笔记狗"];
  const emoji = Math.random() > 0.5 ? "🐱" : "🐶";
  const suffix = Math.floor(100 + Math.random() * 900);

  return {
    nickname: `${getRandomItem(moods)}${getRandomItem(names)}-${suffix}`,
    avatar: {
      emoji,
      color: getRandomItem(colors)
    }
  };
}

function getIdentity() {
  if (state.identity) return state.identity;

  try {
    const saved = JSON.parse(localStorage.getItem(ANON_IDENTITY_KEY) || "null");
    if (saved?.nickname && saved?.avatar?.emoji && saved?.avatar?.color) {
      state.identity = saved;
      return state.identity;
    }
  } catch (error) {
    state.identity = null;
  }

  state.identity = randomIdentity();
  localStorage.setItem(ANON_IDENTITY_KEY, JSON.stringify(state.identity));
  return state.identity;
}

function setIdentity(identity) {
  state.identity = identity;
  localStorage.setItem(ANON_IDENTITY_KEY, JSON.stringify(identity));
  renderIdentity();
}

function renderAvatar(identity) {
  const avatar = identity.avatar || {};
  return `
    <div class="anon-avatar" style="--avatar-color: ${escapeHtml(avatar.color || "#2f6f8f")}">
      <span>${escapeHtml(avatar.emoji || "✦")}</span>
    </div>
  `;
}

function renderIdentity() {
  const identity = getIdentity();
  els.anonAvatar.style.setProperty("--avatar-color", identity.avatar.color);
  els.anonAvatar.innerHTML = `<span>${escapeHtml(identity.avatar.emoji)}</span>`;
  els.anonName.textContent = identity.nickname;
  els.noteHint.textContent = COMMENTS_ENDPOINT
    ? "评论会通过 Worker 写入仓库，提交后所有人都能看到。"
    : "尚未配置评论 Worker，当前评论只保存在本机浏览器。";
}

function renderDigestList() {
  els.digestList.innerHTML = getDigestsByDate()
    .map((digest) => {
      const brief = digest.keywords.join(" · ");
      return `
        <button class="digest-link" type="button" data-digest="${escapeHtml(digest.id)}" aria-current="${digest.id === state.activeDigestId}">
          <span class="digest-date">${escapeHtml(digest.date)}</span>
          <span class="digest-brief">${escapeHtml(brief)}</span>
        </button>
      `;
    })
    .join("");
}

function setNavCollapsed(collapsed) {
  els.siteShell.classList.toggle("nav-collapsed", collapsed);
  els.navToggle.setAttribute("aria-expanded", String(!collapsed));
  els.navToggle.setAttribute("aria-label", collapsed ? "展开目录" : "收起目录");
  localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? "true" : "false");
}

function initNavState() {
  setNavCollapsed(localStorage.getItem(NAV_COLLAPSED_KEY) === "true");
}

function renderDigest() {
  const digest = getActiveDigest();
  if (!digest) return;

  els.activeDate.textContent = digest.date;
  els.activeTitle.textContent = digest.title;
  els.notesIssue.textContent = digest.date;

  const tagButtons = digest.tags.map((tag) => `
    <button class="tag-button" type="button" data-scroll-tag="${escapeHtml(tag.id)}" style="--tag-color: ${escapeHtml(tag.color)}">
      ${escapeHtml(tag.label)}
    </button>
  `).join("");

  const sections = digest.tags.map((tag) => {
    const papers = digest.papers.filter((paper) => paper.tag === tag.id);
    const paperCards = papers.map((paper) => `
      <article class="paper-card" id="${escapeHtml(paper.id)}" style="--tag-color: ${escapeHtml(tag.color)}">
        <div class="paper-body">
          <span class="paper-tag">${escapeHtml(tag.label)}</span>
          <h4>${escapeHtml(paper.title)}</h4>
          <p class="paper-comment">${escapeHtml(paper.comment)}</p>
          <div class="paper-meta">
            <span><strong>抓取位置：</strong>${escapeHtml(paper.source)}</span>
            <span><strong>作者：</strong>${escapeHtml(paper.authors.join(", "))}</span>
            <span><strong>单位：</strong>${escapeHtml(paper.affiliations.join("; "))}</span>
          </div>
          <div class="paper-actions">
            <a class="read-link" href="${escapeHtml(paper.link)}">阅读全文</a>
          </div>
        </div>
      </article>
    `).join("");

    return `
      <section class="research-section" id="section-${escapeHtml(tag.id)}">
        <div class="section-header">
          <div>
            <h3>${escapeHtml(tag.label)}</h3>
            <p>${escapeHtml(tag.description)}</p>
          </div>
          <span class="result-tag" style="--tag-color: ${escapeHtml(tag.color)}">${papers.length} 篇</span>
        </div>
        <div class="paper-grid">${paperCards}</div>
      </section>
    `;
  }).join("");

  els.digestArticle.innerHTML = `
    <section class="issue-cover">
      <div class="cover-copy">
        <p class="eyebrow">Weekly Digest · ${escapeHtml(digest.date)}</p>
        <h1 class="issue-title">${escapeHtml(digest.title)}</h1>
        <p class="issue-summary">${escapeHtml(digest.summary)}</p>
        <div class="tag-strip" aria-label="本期内容标签">${tagButtons}</div>
      </div>
      <div class="cover-meta">
        <div class="cover-stat"><strong>${digest.papers.length}</strong><span>papers collected</span></div>
        <div class="cover-stat"><strong>${digest.tags.length}</strong><span>topic tags</span></div>
      </div>
    </section>
    ${digest.bodyHtml ? `<section class="issue-note">${digest.bodyHtml}</section>` : ""}
    ${sections}
  `;

  renderNotes();
  if (COMMENTS_ENDPOINT && !state.remoteNotes[digest.id]) {
    fetchRemoteNotes(digest.id);
  }
}

function getLocalNotes() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_NOTES_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function saveLocalNotes(notes) {
  localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(notes));
}

function normalizeSeedNote(note) {
  return {
    id: `${note.user}-${note.time}-${note.text}`.slice(0, 80),
    nickname: note.user.replace(/^@/, ""),
    avatar: {
      emoji: "✦",
      color: "#2f6f8f"
    },
    time: note.time,
    text: note.text,
    source: "seed"
  };
}

function formatCommentTime(note) {
  if (note.time) return note.time;
  if (!note.createdAt) return "";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(note.createdAt));
  } catch (error) {
    return "";
  }
}

async function fetchRemoteNotes(digestId) {
  if (!COMMENTS_ENDPOINT) return;

  state.remoteLoading = true;
  renderNotes();

  try {
    const response = await fetch(`${COMMENTS_ENDPOINT}?digestId=${encodeURIComponent(digestId)}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.remoteNotes[digestId] = Array.isArray(data.comments) ? data.comments : [];
  } catch (error) {
    state.remoteNotes[digestId] = state.remoteNotes[digestId] || [];
    els.noteHint.textContent = "暂时无法读取仓库评论，可以稍后刷新。";
  } finally {
    state.remoteLoading = false;
    renderNotes();
  }
}

async function submitRemoteNote(note) {
  const response = await fetch(COMMENTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(note)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  return response.json();
}

function renderNotes() {
  const digest = getActiveDigest();
  const localNotes = getLocalNotes()[digest.id] || [];
  const remoteNotes = state.remoteNotes[digest.id] || [];
  const notes = [
    ...digest.notes.map(normalizeSeedNote),
    ...remoteNotes,
    ...localNotes
  ];

  els.noteStream.innerHTML = [
    state.remoteLoading ? '<p class="note-loading">正在读取评论...</p>' : "",
    ...notes.map((note) => `
      <article class="note-item">
        ${renderAvatar(note)}
        <div>
          <div class="note-user">
            <span>${escapeHtml(note.nickname || "匿名同学")}</span>
            <span class="note-time">${escapeHtml(formatCommentTime(note))}</span>
          </div>
          <p>${escapeHtml(note.text)}</p>
        </div>
      </article>
    `)
  ].join("");
}

function collectMatches() {
  const query = state.query.trim().toLowerCase();
  if (!query) {
    return [];
  }

  return getDigestsByDate().flatMap((digest) => digest.papers.map((paper) => {
    const tagInfo = tagById(digest, paper.tag);
    return { digest, paper, tagInfo };
  })).filter(({ digest, paper, tagInfo }) => {
    const text = [
      tagInfo.label,
      paper.title,
      paper.source,
      paper.authors.join(" "),
      paper.affiliations.join(" "),
      paper.comment,
      paper.body || ""
    ].join(" ").toLowerCase();

    return text.includes(query);
  });
}

function renderSearchResults() {
  const matches = collectMatches();
  if (!state.query.trim()) {
    els.searchResults.hidden = true;
    els.searchResults.innerHTML = "";
    return;
  }

  const resultList = matches.map(({ digest, paper, tagInfo }) => `
    <article class="result-item">
      <div>
        <span class="result-tag" style="--tag-color: ${escapeHtml(tagInfo.color)}">${escapeHtml(tagInfo.label)}</span>
        <h4>${escapeHtml(paper.title)}</h4>
        <p>${escapeHtml(digest.date)} · ${escapeHtml(paper.authors.join(", "))} · ${escapeHtml(paper.source)}</p>
      </div>
      <button class="open-result" type="button" data-open-digest="${escapeHtml(digest.id)}" data-open-paper="${escapeHtml(paper.id)}">打开</button>
    </article>
  `).join("");

  els.searchResults.hidden = false;
  els.searchResults.innerHTML = `
    <h3>找到 ${matches.length} 篇</h3>
    <div class="result-list">${resultList || "<p>没有匹配的论文。</p>"}</div>
  `;
}

function setActiveDigest(digestId) {
  state.activeDigestId = digestId;
  renderDigestList();
  renderDigest();
  renderSearchResults();
  history.replaceState(null, "", `#${digestId}`);
}

function scrollToPaper(digestId, paperId) {
  setActiveDigest(digestId);
  requestAnimationFrame(() => {
    const paper = document.getElementById(paperId);
    if (paper) {
      paper.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

function initFromHash() {
  const id = window.location.hash.replace("#", "");
  if (DIGESTS.some((digest) => digest.id === id)) {
    state.activeDigestId = id;
  }
}

els.digestList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-digest]");
  if (button) {
    setActiveDigest(button.dataset.digest);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

els.digestArticle.addEventListener("click", (event) => {
  const button = event.target.closest("[data-scroll-tag]");
  if (!button) return;
  const section = document.getElementById(`section-${button.dataset.scrollTag}`);
  if (section) {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

els.searchResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-digest]");
  if (button) {
    scrollToPaper(button.dataset.openDigest, button.dataset.openPaper);
  }
});

els.paperSearch.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderSearchResults();
});

els.navToggle.addEventListener("click", () => {
  setNavCollapsed(!els.siteShell.classList.contains("nav-collapsed"));
});

els.shuffleIdentity.addEventListener("click", () => {
  setIdentity(randomIdentity());
});

els.notesToggle.addEventListener("click", () => {
  const open = !els.notesDrawer.classList.contains("is-open");
  els.notesDrawer.classList.toggle("is-open", open);
  els.notesDrawer.setAttribute("aria-hidden", String(!open));
  els.notesToggle.setAttribute("aria-expanded", String(open));
});

els.closeNotes.addEventListener("click", () => {
  els.notesDrawer.classList.remove("is-open");
  els.notesDrawer.setAttribute("aria-hidden", "true");
  els.notesToggle.setAttribute("aria-expanded", "false");
});

els.noteComposer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = els.noteText.value.trim();
  if (!text) return;

  const digestId = state.activeDigestId;
  const identity = getIdentity();
  const draft = {
    digestId,
    nickname: identity.nickname,
    avatar: identity.avatar,
    createdAt: new Date().toISOString(),
    text
  };

  els.saveNote.disabled = true;
  els.saveNote.textContent = "提交中";

  try {
    if (COMMENTS_ENDPOINT) {
      const data = await submitRemoteNote(draft);
      const comment = data.comment || draft;
      state.remoteNotes[digestId] = [...(state.remoteNotes[digestId] || []), comment];
      els.noteHint.textContent = "评论已写入仓库。";
    } else {
      const notes = getLocalNotes();
      notes[digestId] = notes[digestId] || [];
      notes[digestId].push({
        ...draft,
        id: `local-${Date.now()}`,
        time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      });
      saveLocalNotes(notes);
      els.noteHint.textContent = "未配置评论 Worker，已保存到本机草稿。";
    }
    els.noteText.value = "";
    renderNotes();
  } catch (error) {
    const notes = getLocalNotes();
    notes[digestId] = notes[digestId] || [];
    notes[digestId].push({
      ...draft,
      id: `local-${Date.now()}`,
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    });
    saveLocalNotes(notes);
    els.noteHint.textContent = "提交到仓库失败，已先保存在本机草稿。";
    renderNotes();
  } finally {
    els.saveNote.disabled = false;
    els.saveNote.textContent = "提交评论";
  }
});

initFromHash();
initNavState();
renderIdentity();
renderDigestList();
renderDigest();
renderSearchResults();
