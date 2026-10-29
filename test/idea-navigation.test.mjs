import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const script = readFileSync(new URL("../public/assets/ideas.js", import.meta.url), "utf8");

function fixture(hash = "") {
  const element = (dataset = {}) => ({
    dataset, events: {}, attributes: {},
    addEventListener(name, callback) { this.events[name] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { this.focused = true; }
  });
  const tabs = ["first", "second"].map(id => element({ directionTarget: id }));
  const panels = ["first", "second"].map((id, index) => ({
    ...element({ directionPanel: id }), hidden: index !== 0
  }));
  const select = { ...element(), value: "first" };
  const navigation = element();
  const location = { hash };
  const window = element();
  const history = { calls: [], replaceState(_state, _title, url) { this.calls.push(url); location.hash = url; } };
  const document = {
    querySelectorAll: selector => ({
      "[data-direction-target]": tabs,
      "[data-direction-panel]": panels,
      "[data-direction-select]": [select],
      "[data-direction-navigation]": [navigation]
    })[selector] || [],
    getElementById: id => id === "idea-second" ? { closest: () => panels[1] } : null
  };
  vm.runInNewContext(script, { document, window, location, history });
  return { tabs, panels, select, navigation, location, window, history };
}

test("mobile selection updates the panel, desktop tabs, and shareable hash together", () => {
  const f = fixture();
  assert.equal(f.navigation.dataset.directionNavigation, "enhanced");
  f.select.value = "second";
  f.select.events.change();
  assert.deepEqual(f.panels.map(panel => panel.hidden), [true, false]);
  assert.deepEqual(f.tabs.map(tab => tab.attributes["aria-selected"]), ["false", "true"]);
  assert.deepEqual(f.tabs.map(tab => tab.tabIndex), [-1, 0]);
  assert.equal(f.location.hash, "#second");
  assert.ok(f.tabs.every(tab => !tab.focused));
});

test("idea deep links and subsequent hash navigation keep both selectors synchronized", () => {
  const f = fixture("#idea-second");
  assert.equal(f.select.value, "second");
  assert.deepEqual(f.panels.map(panel => panel.hidden), [true, false]);
  f.location.hash = "#first";
  f.window.events.hashchange();
  assert.equal(f.select.value, "first");
  assert.deepEqual(f.panels.map(panel => panel.hidden), [false, true]);
  assert.deepEqual(f.history.calls, []);
});

test("keyboard tab navigation wraps, moves focus, and syncs the mobile selection", () => {
  const f = fixture();
  let prevented = 0;
  f.tabs[0].events.keydown({ key: "ArrowLeft", preventDefault() { prevented++; } });
  assert.equal(f.select.value, "second");
  assert.equal(f.tabs[1].focused, true);
  f.tabs[1].events.keydown({ key: "Home", preventDefault() { prevented++; } });
  assert.equal(f.select.value, "first");
  assert.equal(f.tabs[0].focused, true);
  assert.equal(prevented, 2);
});

test("malformed and unknown hashes leave direction controls usable", () => {
  for (const hash of ["#%zz", "#missing"]) {
    const f = fixture(hash);
    assert.equal(f.navigation.dataset.directionNavigation, "enhanced");
    assert.equal(f.select.value, "first");
    assert.deepEqual(f.panels.map(panel => panel.hidden), [false, true]);
    f.tabs[1].events.click();
    assert.equal(f.select.value, "second");
    assert.equal(f.location.hash, "#second");
  }
});
