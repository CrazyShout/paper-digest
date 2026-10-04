export function preserveSearchButtonActivation(event) {
  if (event.key === "Enter" && event.target?.closest?.("button")) {
    // The results list also handles Enter on window; let focused buttons act normally.
    event.stopPropagation();
  }
}
