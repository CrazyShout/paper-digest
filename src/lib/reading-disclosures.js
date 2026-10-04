export function revealReadingFragment(document, hash) {
  let id;
  try { id = decodeURIComponent(String(hash || "").replace(/^#/, "")); } catch { return null; }
  if (!id) return null;
  const target = document.getElementById(id);
  if (!target) return null;
  for (let node = target; node; node = node.parentElement) {
    if (node.tagName === "DETAILS") node.open = true;
  }
  return target;
}

export function readingPrintState(document) {
  let snapshot = null;
  return {
    before() {
      if (snapshot) return;
      const details = [...document.querySelectorAll("details")].map((node) => [node, node.open]);
      const panels = [...document.querySelectorAll("[data-direction-panel]")].map((node) => [node, node.hidden]);
      snapshot = { details, panels };
      details.forEach(([node]) => { node.open = true; });
      panels.forEach(([node]) => { node.hidden = false; });
    },
    after() {
      if (!snapshot) return;
      snapshot.details.forEach(([node, open]) => { node.open = open; });
      snapshot.panels.forEach(([node, hidden]) => { node.hidden = hidden; });
      snapshot = null;
    }
  };
}
