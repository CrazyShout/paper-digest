const DIGESTS = window.PAPER_DIGESTS || [];
const LOCAL_NOTES_KEY = "paper-digest-local-notes";

function getDigestsByDate() {
  return DIGESTS.slice().sort((a, b) => b.date.localeCompare(a.date));
}

const state = {
  activeDigestId: getDigestsByDate()[0]?.id || "",
  query: "",
  tag: ""
};

const els = {
  digestList: document.getElementById("digestList"),
  activeDate: document.getElementById("activeDate"),
  activeTitle: document.getElementById("activeTitle"),
  paperSearch: document.getElementById("paperSearch"),
  tagFilter: document.getElementById("tagFilter"),
  searchResults: document.getElementById("searchResults"),
  digestArticle: document.getElementById("digestArticle"),
  notesToggle: document.getElementById("notesToggle"),
  notesDrawer: document.getElementById("notesDrawer"),
  closeNotes: document.getElementById("closeNotes"),
  notesIssue: document.getElementById("notesIssue"),
  noteStream: document.getElementById("noteStream"),
  noteComposer: document.getElementById("noteComposer"),
  githubHandle: document.getElementById("githubHandle"),
  noteText: document.getElementById("noteText")
};

function getActiveDigest() {
  return DIGESTS.find((digest) => digest.id === state.activeDigestId) || getDigestsByDate()[0];
}

function tagById(digest, tagId) {
  return digest.tags.find((tag) => tag.id === tagId) || { id: tagId, label: tagId, color: "#b45f49" };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function renderTagFilter() {
  const tags = new Map();
  getDigestsByDate().forEach((digest) => {
    digest.tags.forEach((tag) => tags.set(tag.id, tag));
  });
  els.tagFilter.innerHTML = '<option value="">全部方向</option>' + Array.from(tags.values())
    .map((tag) => `<option value="${escapeHtml(tag.id)}">${escapeHtml(tag.label)}</option>`)
    .join("");
  els.tagFilter.value = state.tag;
}

function renderVisual(paper) {
  return `
    <div class="paper-visual ${escapeHtml(paper.visual)}" data-label="${escapeHtml(paper.visualLabel)}" aria-label="${escapeHtml(paper.visualLabel)}">
      <span></span><span></span><span></span>
    </div>
  `;
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
      <article class="paper-card" id="${escapeHtml(paper.id)}">
        ${renderVisual(paper)}
        <div class="paper-body">
          <span class="paper-tag" style="--tag-color: ${escapeHtml(tag.color)}">${escapeHtml(tag.label)}</span>
          <h4>${escapeHtml(paper.title)}</h4>
          <div class="paper-meta">
            <span><strong>抓取位置：</strong>${escapeHtml(paper.source)}</span>
            <span><strong>作者：</strong>${escapeHtml(paper.authors.join(", "))}</span>
            <span><strong>单位：</strong>${escapeHtml(paper.affiliations.join("; "))}</span>
          </div>
          <p class="paper-comment">${escapeHtml(paper.comment)}</p>
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
      <div>
        <p class="eyebrow">Weekly Digest · ${escapeHtml(digest.date)}</p>
        <h1 class="issue-title">${escapeHtml(digest.title)}</h1>
        <p class="issue-summary">${escapeHtml(digest.summary)}</p>
      </div>
      <div class="cover-meta">
        <div class="cover-stat"><strong>${digest.papers.length}</strong><span>papers collected</span></div>
        <div class="cover-stat"><strong>${digest.tags.length}</strong><span>research directions</span></div>
      </div>
    </section>
    <div class="tag-strip" aria-label="本期研究方向">${tagButtons}</div>
    ${sections}
  `;

  renderNotes();
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

function renderNotes() {
  const digest = getActiveDigest();
  const localNotes = getLocalNotes()[digest.id] || [];
  const notes = [...digest.notes, ...localNotes];

  els.noteStream.innerHTML = notes.map((note) => {
    const handle = note.user.replace(/^@/, "");
    return `
      <article class="note-item">
        <img src="https://github.com/${escapeHtml(handle)}.png?size=64" alt="${escapeHtml(note.user)} 的 GitHub 头像">
        <div>
          <div class="note-user">
            <span>@${escapeHtml(handle)}</span>
            <span class="note-time">${escapeHtml(note.time)}</span>
          </div>
          <p>${escapeHtml(note.text)}</p>
        </div>
      </article>
    `;
  }).join("");
}

function collectMatches() {
  const query = state.query.trim().toLowerCase();
  const tag = state.tag;
  if (!query && !tag) {
    return [];
  }

  return getDigestsByDate().flatMap((digest) => digest.papers.map((paper) => {
    const tagInfo = tagById(digest, paper.tag);
    return { digest, paper, tagInfo };
  })).filter(({ digest, paper, tagInfo }) => {
    const text = [
      digest.date,
      digest.title,
      tagInfo.label,
      paper.title,
      paper.source,
      paper.authors.join(" "),
      paper.affiliations.join(" "),
      paper.comment
    ].join(" ").toLowerCase();

    const queryMatch = !query || text.includes(query);
    const tagMatch = !tag || paper.tag === tag;
    return queryMatch && tagMatch;
  });
}

function renderSearchResults() {
  const matches = collectMatches();
  if (!state.query && !state.tag) {
    els.searchResults.hidden = true;
    els.searchResults.innerHTML = "";
    return;
  }

  const tags = new Map();
  getDigestsByDate().forEach((digest) => digest.tags.forEach((tag) => tags.set(tag.id, tag)));
  const label = state.tag ? (tags.get(state.tag)?.label || state.tag) : "全部方向";

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
    <h3>找到 ${matches.length} 篇 · ${escapeHtml(label)}</h3>
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

els.tagFilter.addEventListener("change", (event) => {
  state.tag = event.target.value;
  renderSearchResults();
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

els.noteComposer.addEventListener("submit", (event) => {
  event.preventDefault();
  const handle = els.githubHandle.value.trim().replace(/^@/, "");
  const text = els.noteText.value.trim();
  if (!handle || !text) return;

  const notes = getLocalNotes();
  const digestId = state.activeDigestId;
  notes[digestId] = notes[digestId] || [];
  notes[digestId].push({
    user: handle,
    time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    text
  });
  saveLocalNotes(notes);
  els.noteText.value = "";
  renderNotes();
});

initFromHash();
renderDigestList();
renderTagFilter();
renderDigest();
renderSearchResults();
