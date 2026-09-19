import katex from "katex";

/** Render a TeX string to HTML. Safe against malformed TeX (renders as-is). */
export function renderMath(tex: string, displayMode = false): string {
  return katex.renderToString(tex, { displayMode, throwOnError: false });
}
