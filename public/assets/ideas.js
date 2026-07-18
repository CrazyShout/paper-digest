(() => {
  const tabs = [...document.querySelectorAll("[data-direction-target]")];
  const panels = [...document.querySelectorAll("[data-direction-panel]")];

  function selectDirection(directionId, options = {}) {
    const nextTab = tabs.find((tab) => tab.dataset.directionTarget === directionId);
    const nextPanel = panels.find((panel) => panel.dataset.directionPanel === directionId);
    if (!nextTab || !nextPanel) return false;

    for (const tab of tabs) {
      const selected = tab === nextTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }

    for (const panel of panels) {
      panel.hidden = panel !== nextPanel;
    }

    if (options.focus) nextTab.focus();
    if (options.updateHash) history.replaceState(null, "", `#${directionId}`);
    return true;
  }

  function selectHashTarget() {
    const hashTarget = decodeURIComponent(location.hash.slice(1));
    if (!hashTarget || selectDirection(hashTarget)) return;

    const idea = document.getElementById(hashTarget);
    const panel = idea?.closest("[data-direction-panel]");
    if (panel) selectDirection(panel.dataset.directionPanel);
  }

  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => {
      selectDirection(tab.dataset.directionTarget, { updateHash: true });
    });

    tab.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      let nextIndex = index;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (["ArrowDown", "ArrowRight"].includes(event.key)) nextIndex = (index + 1) % tabs.length;
      if (["ArrowUp", "ArrowLeft"].includes(event.key)) nextIndex = (index - 1 + tabs.length) % tabs.length;

      selectDirection(tabs[nextIndex].dataset.directionTarget, {
        focus: true,
        updateHash: true
      });
    });
  }

  window.addEventListener("hashchange", selectHashTarget);
  selectHashTarget();
})();
