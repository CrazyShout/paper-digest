# Paper Digest

一个用于组内周期性论文抓取、阅读报告和简报分享的静态站点原型。

当前版本采用：

- `content/`：Markdown 内容源，适合 Codex 或抓取脚本生成。
- `src/`：页面样式和前端交互模板。
- `scripts/build-site.mjs`：零依赖静态生成器。
- `docs/`：构建产物，匹配当前 GitHub Pages 的 `main /docs` 发布设置。

## 本地使用

```bash
npm run build
npm run preview
```

`npm run build` 会读取 `content/`，生成：

- `docs/index.html`：简报首页。
- `docs/papers/*/index.html`：每篇论文的详细报告页。
- `docs/assets/data.js`：由 Markdown 汇总出的前端数据。
- `docs/assets/styles.css` 和 `docs/assets/site.js`：页面视觉和交互。

如果只是本地看效果，也可以直接打开：

```text
docs/index.html
```

## 内容结构

研究方向统一放在：

```text
content/tags.json
```

每篇论文一个 Markdown：

```text
content/papers/agent-collaboration.md
```

每期简报一个 Markdown：

```text
content/digests/2026-05-11.md
```

论文 Markdown 的 frontmatter 示例：

```md
---
{
  "id": "agent-collaboration",
  "tag": "agent-reasoning",
  "title": "Long-Horizon Agent Collaboration with Shared Memory",
  "source": "arXiv / OpenReview / GitHub",
  "authors": ["Lin Zhao", "Mei Chen", "Daniel Park"],
  "affiliations": ["Tsinghua University", "Stanford University", "MIT CSAIL"],
  "comment": "一句简评",
  "visual": "visual-network",
  "visualLabel": "agent trace"
}
---

## 核心问题

这里写详细阅读报告。
```

简报 Markdown 只需要引用论文 id：

```md
---
{
  "id": "2026-05-11",
  "date": "2026-05-11",
  "title": "本期标题",
  "summary": "本期摘要",
  "keywords": ["关键词1", "关键词2"],
  "papers": ["agent-collaboration", "robot-world-model"],
  "notes": []
}
---
```

## GitHub Pages Source

你截图里现在是：

```text
Deploy from a branch
main /docs
```

这个设置目前不用改。因为本项目已经把构建产物输出到 `docs/`，只要提交并 push `docs/`，GitHub Pages 就会继续从 `https://crazyshout.github.io/paper-digest/` 发布。

后续有两种路线：

1. 保持现在的 `main /docs`：最简单，但需要把 `docs/` 构建产物一起 commit。
2. 改成 `GitHub Actions`：更干净，仓库可以只维护 `content/`、`src/`、`scripts/`，Actions 每次 push 后自动构建并部署，不需要 commit `docs/`。

短期建议先保持 `main /docs`。等内容流和页面设计稳定后，再切到 GitHub Actions。

## 后续升级点

- 把零依赖生成器替换为 Astro content collections，获得 schema 校验和更强模板能力。
- 接入 Pagefind，替换当前前端简易搜索，支持更强的全文搜索和 tag filter。
- 把论文主图从抓取脚本保存到 `docs/assets/figures/` 或 `public/figures/`，替换现在的 CSS 占位图。
- 如果要真正组内私密，不要只依赖 GitHub Pages 隐藏路径，应部署到 Cloudflare Access、Netlify/Vercel 登录、Tailscale/VPN 或 GitHub Enterprise Cloud private Pages。

参考：

- [GitHub Docs: About GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)
- [GitHub Docs: Changing the visibility of your GitHub Pages site](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)
- [giscus configuration requirements](https://giscus.app/)
