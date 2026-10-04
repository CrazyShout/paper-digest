import assert from "node:assert/strict";
import test from "node:test";
import { preserveSearchButtonActivation } from "../src/lib/search-keyboard.js";

function keyEvent(key, insideButton) {
  return {
    key,
    target: { closest: (selector) => selector === "button" && insideButton ? {} : null },
    stopped: false,
    defaultPrevented: false,
    stopPropagation() { this.stopped = true; },
    preventDefault() { this.defaultPrevented = true; }
  };
}

test("Enter on dialog buttons preserves their native click without selecting the active result", () => {
  const event = keyEvent("Enter", true);
  preserveSearchButtonActivation(event);
  const actions = [];
  if (!event.stopped) actions.push("navigate-active-result");
  if (!event.defaultPrevented) actions.push("activate-focused-button");
  assert.deepEqual(actions, ["activate-focused-button"]);
});

test("the input keeps Enter and arrow navigation, and Escape still reaches the dialog", () => {
  for (const insideButton of [false, true]) {
    for (const key of ["ArrowDown", "ArrowUp", "Escape", " "]) {
      const event = keyEvent(key, insideButton);
      preserveSearchButtonActivation(event);
      assert.equal(event.stopped, false);
      assert.equal(event.defaultPrevented, false);
    }
  }
  const inputEnter = keyEvent("Enter", false);
  preserveSearchButtonActivation(inputEnter);
  assert.equal(inputEnter.stopped, false);
  assert.doesNotThrow(() => preserveSearchButtonActivation({ key: "Enter", target: null }));
});
