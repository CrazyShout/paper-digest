# Paper Digest

组内周期性论文抓取、阅读报告和简报分享站点。当前路线是：

- Codex 或抓取脚本生成 Markdown 内容源。
- Astro 作为静态站点模板层，负责页面、组件和构建。
- GitHub Actions 自动构建并部署到 GitHub Pages。
- Cloudflare Worker 可选接入匿名评论，把评论写回仓库。

## Project Layout

```text
config/
  research-interests.json   # 组内研究兴趣配置，给后续抓取脚本使用
  runtime.json              # 前端运行时配置，例如评论 Worker URL
content/
  README.md                 # 更新简报的具体操作说明
  digests/                  # 每期简报 Markdown
  papers/                   # 每篇论文详细报告 Markdown
src/
  components/               # Astro 页面组件
  layouts/                  # 基础 HTML 布局
  lib/content.js            # 读取 Markdown 和配置并生成页面数据
  pages/                    # 首页、论文详情页、静态数据端点
public/assets/              # 前端交互脚本和 CSS
docs/                       # Astro 构建产物，兼容 main /docs 发布方式
.github/workflows/          # GitHub Pages 自动部署 workflow
worker/                     # 评论写回仓库的 Cloudflare Worker 示例
```

`docs/` 现在仍然保留并提交，是为了兼容你当前 GitHub Pages 的 `main /docs` 设置。等 GitHub Actions 发布稳定后，可以选择不再提交 `docs/`，只把它作为 CI 产物。

## Local Development

首次安装依赖：

```bash
npm install
```

本地开发预览：

```bash
npm run dev
```

生成静态站点：

```bash
npm run build
```

预览构建产物：

```bash
npm run preview
```

只想快速看静态结果，也可以直接打开：

```text
docs/index.html
```

## Content Model

日常更新简报的具体步骤见：

```text
content/README.md
```

研究方向统一放在：

```text
config/research-interests.json
```

这个文件主要服务后续论文抓取和筛选。页面顶部的 tag 不做固定筛选下拉，而是每期简报根据实际入选论文动态生成。

每篇论文一个 Markdown：

```text
content/papers/cooperative-driving-planning.md
```

示例：

```md
---
{
  "id": "cooperative-driving-planning",
  "tag": "cooperative-autonomous-driving",
  "title": "Cooperative Planning for Connected Autonomous Vehicles",
  "source": "arXiv / project page",
  "authors": ["Yifan Zhang", "Mei Chen", "Daniel Park"],
  "affiliations": ["Tsinghua University", "Stanford University", "MIT CSAIL"],
  "comment": "一句简评",
  "visual": "visual-network",
  "visualLabel": "CAV planning"
}
---

## 核心问题

这里写详细阅读报告。
```

每期简报一个 Markdown：

```text
content/digests/2026-05-11.md
```

示例：

```md
---
{
  "id": "2026-05-11",
  "date": "2026-05-11",
  "title": "本期标题",
  "summary": "本期摘要",
  "keywords": ["关键词1", "关键词2"],
  "papers": ["cooperative-driving-planning", "driving-world-model"],
  "notes": []
}
---
```

## GitHub Pages Deploy

本仓库已经加入：

```text
.github/workflows/deploy-pages.yml
```

workflow 会在 push 到 `main` 后执行：

1. `npm ci`
2. `npm run build`
3. 上传 `docs/`
4. 部署到 GitHub Pages

要启用 Actions 发布，需要在 GitHub 仓库页面操作：

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

如果暂时不切换，保持 `Deploy from a branch` 和 `main /docs` 也能继续工作，因为 Astro 仍然输出到 `docs/`。

## Anonymous Comments

纯 GitHub Pages 不能安全地直接写仓库，因为前端不能暴露 GitHub token。本项目用可选的 Cloudflare Worker 作为后端：

```text
GitHub Pages frontend
  -> Cloudflare Worker
    -> GitHub Contents API
      -> comments/YYYY-MM-DD.json
```

部署 Worker 后，把 URL 写入：

```text
config/runtime.json
```

```json
{
  "commentsEndpoint": "https://paper-digest-comments.your-name.workers.dev"
}
```

然后重新构建：

```bash
npm run build
```

Worker 文件：

```text
worker/comments-worker.mjs
```

部署时可以复制示例配置：

```bash
cp worker/wrangler.toml.example worker/wrangler.toml
cd worker
wrangler secret put GITHUB_TOKEN
wrangler deploy
```

`GITHUB_TOKEN` 建议使用 GitHub fine-grained personal access token，只给当前仓库 `Contents: Read and write` 权限。不要把 token 写进前端代码或提交到仓库。

Worker 需要这些变量：

- `GITHUB_OWNER`：例如 `CrazyShout`
- `GITHUB_REPO`：例如 `paper-digest`
- `GITHUB_BRANCH`：通常是 `main`
- `COMMENTS_DIR`：默认 `comments`
- `ALLOWED_ORIGIN`：建议填 `https://crazyshout.github.io`

注意：匿名评论没有登录鉴权，任何能访问页面的人理论上都能提交评论。Worker 已做长度和字段校验；公开使用后建议再加 Cloudflare Turnstile、限流或人工 review。

## References

- [Astro GitHub Pages guide](https://docs.astro.build/en/guides/deploy/github/)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
