import assert from "node:assert/strict";
import test from "node:test";
import { getMarkdownHeadings, markdownToHtml } from "../src/lib/content.js";

test("math renders at build time with accessible MathML and intact TeX", () => {
  const html = markdownToHtml(String.raw`令 $x_i$ 为输入，**损失 $L$** 最小。

$$
\mathcal{L}=\frac{1}{N}\sum_{i=1}^{N} x_i^2
$$

## 实验`, { headingIds: true });
  assert.equal((html.match(/<math /g) || []).length, 3);
  assert.match(html, /display="block"/);
  assert.match(html, /encoding="application\/x-tex"/);
  assert.match(html, /<h2 id="实验">实验<\/h2>/);
  assert.match(html, /class="reading-math"[^>]+tabindex="0"/);
  assert.doesNotMatch(html, /katex-error|<script/);
});

test("code and literal currency are not interpreted as formulas", () => {
  const html = markdownToHtml(String.raw`\$5 and \$10; \$x\$; ` + "`$not_math$`; $x$");
  assert.match(html, /\$5 and \$10; \$x\$; <code>\$not_math\$<\/code>/);
  assert.equal((html.match(/<math /g) || []).length, 1);
  assert.match(markdownToHtml("$2 + 3$"), /<math /);
  assert.equal(markdownToHtml("Budget: $5 and $10."), "<p>Budget: $5 and $10.</p>");
});

test("tables retain numbers, math, links, code pipes and escaped separators", () => {
  const html = markdownToHtml(String.raw`## Evidence

| Method | Score | Note |
| :--- | ---: | :---: |
| [Ours](https://example.org/paper) | **93.68** | $\lvert x\rvert$ |
| ${"`a|b`"} | 93.31 | left\|right |

After.`, { headingIds: true });
  assert.match(html, /<th scope="col" style="text-align:right">Score<\/th>/);
  assert.equal((html.match(/<td /g) || []).length, 6);
  assert.match(html, /<strong>93\.68<\/strong>/);
  assert.match(html, /<code>a\|b<\/code>/);
  assert.match(html, /left\|right/);
  assert.match(html, /href="https:\/\/example\.org\/paper"/);
  assert.match(html, /<p>After\.<\/p>$/);
});

test("malformed formulas and inconsistent table columns fail visibly", () => {
  assert.throws(() => markdownToHtml("$$\nx+1"), /Unclosed display math/);
  assert.throws(() => markdownToHtml(String.raw`$\frac{x}$`), /KaTeX parse error/);
  assert.throws(() => markdownToHtml("| A | B |\n| --- | --- |\n| 1 | 2 | 3 |"), /has 3 cells; expected 2/);
  assert.equal(markdownToHtml("a | b"), "<p>a | b</p>");
});

test("new Markdown forms preserve escaping and disallow trusted TeX HTML", () => {
  const html = markdownToHtml(String.raw`| Input | Output |
| --- | --- |
| <script>alert(1)</script> | [bad](javascript:alert) |

$\href{javascript:alert(1)}{unsafe}$`);
  assert.doesNotMatch(html, /<script|href="javascript:|class="injected"/);
  assert.match(html, /&lt;script&gt;/);
  assert.throws(() => markdownToHtml(String.raw`$\htmlClass{injected}{x}$`), /KaTeX parse error/);
});

test("existing heading and figure rendering retains its public contract", () => {
  const markdown = "## Method\n\n- **Safe** [source](https://example.org)\n\n## Method\n\n![Fig](../../assets/papers/a.png)";
  const html = markdownToHtml(markdown, { headingIds: true, images: new Map([
    ["../../assets/papers/a.png", { width: 900, height: 600 }]
  ]) });
  for (const heading of getMarkdownHeadings(markdown)) assert.ok(html.includes(`id="${heading.id}"`));
  assert.match(html, /width="900" height="600"/);
  assert.match(html, /<li><strong>Safe<\/strong>/);
  assert.match(html, /class="paper-figure"/);
});
