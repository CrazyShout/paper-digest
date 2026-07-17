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
dist/                       # Astro 本地构建产物，不提交仓库
.github/workflows/          # GitHub Pages 自动部署 workflow
worker/                     # 评论写回仓库的 Cloudflare Worker 示例
```

GitHub Pages 已使用 Actions 发布。构建产物输出到 `dist/`，由 workflow 上传为 Pages artifact，不再提交到仓库。

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

只运行内容校验：

```bash
npm run validate
```

预览构建产物：

```bash
npm run preview
```

只想快速看静态结果，也可以直接打开：

```text
dist/index.html
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
2. `npm run build`（包含内容去重和索引校验）
3. 上传 `dist/`
4. 部署到 GitHub Pages

要启用 Actions 发布，需要在 GitHub 仓库页面操作：

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

日常更新不需要提交构建产物，只提交 `content/`、`config/`、`src/`、`public/` 等源码文件。

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

## Feishu Wiki Publishing

本项目可以把某期简报发布为飞书知识库父页面，并把每篇详细论文报告发布为其子页面，便于组内直接在飞书里阅读和评论。

先在本机设置环境变量，不要把密钥提交到仓库：

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
export FEISHU_WIKI_URL="https://my.feishu.cn/wiki/xxx"
export FEISHU_WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/xxx" # 可选
```

如果脚本无法从 `FEISHU_WIKI_URL` 自动解析知识库空间，可以额外设置：

```bash
export FEISHU_SPACE_ID="xxx"
export FEISHU_WIKI_PARENT_TOKEN="xxx"
```

注意：飞书开放平台里的 API 权限只表示应用允许调用接口；知识库本身还要给应用/机器人授权。若发布时报：

```text
permission denied: node permission denied, tenant needs edit permission
```

需要在飞书知识库的成员/权限设置中，把这个自建应用或应用机器人加入知识库空间，或至少加入目标父节点，并授予可编辑权限。仅把你本人设为知识库管理员不等于应用有写权限。

发布前先预览将要发布的 Markdown 源内容：

```bash
npm run feishu:preview -- 2026-05-16
```

发布到飞书知识库：

```bash
npm run feishu:publish -- 2026-05-16
```

飞书发布结构为一篇父简报加多篇子页面：

- 父页面是当期简报，标题格式为 `YYYY-MM-DD - 简报标题`，开头先列“方向导航”。
- “方向导航”每个方向只保留一个链接，链接到下方对应的方向分区；方向分区里再列该方向的论文入口。
- 每篇论文报告会发布为父页面下的一个子页面，标题带 `01`、`02` 等序号以保持阅读顺序。
- 父页面中的论文标题会链接到对应子页面；子页面顶部会链接回父简报。
- 跨方向论文会像网页版一样出现在多个方向下，但只维护一个子页面。

发布记录写入：

```text
config/feishu-publications.json
```

如果同一期已经发布，脚本会复用 `config/feishu-publications.json` 中的父页面 `documentId` 和每篇论文的 `paperReports` 记录，更新同一组飞书页面。确实需要重新创建一套新页面时：

```bash
npm run feishu:publish -- 2026-05-16 -- --force-new
```

只修改父简报结构或导航、不需要重写每篇论文子页面时：

```bash
npm run feishu:publish -- 2026-05-16 -- --parent-only
```

当前发布脚本会先调用飞书 Markdown 转 Block 接口，再写入飞书原生 Docx blocks，因此标题、列表、链接和图片不会以 Markdown 语法裸露显示。图片会优先上传为飞书图片块；如果 Node fetch 访问远程图片超时，脚本会自动使用 `curl` 兜底下载；若仍不可访问，才会把该图片降级成可点击链接，避免整次发布失败或留下空白图片块。组内评论直接使用飞书文档原生评论能力。

## Email Digest Notifications

本项目支持一键将简报同步到邮箱。默认会给一个本地邮件列表发邮件，当前默认收件人为 `7608331@qq.com`。

先准备本地收件人列表（文件不会提交）：

```bash
cat > config/email-recipients.local.json <<'JSON'
{
  "recipients": [
    "7608331@qq.com"
  ]
}
JSON
```

如果你用的是 **Google 邮箱（Gmail）**，推荐用「应用专用密码」，避免账号主密码外泄。

获取步骤（Google 侧）：

1. 先到 Google 账户启用「两步验证」。
2. 访问「应用专用密码」页面，创建一个新应用密码（比如 `paper-digest`）。
3. 复制 16 位密码（不带空格），只会显示一次。
4. 将下面配置写入本地文件 `config/smtp.local.json`（该文件已被 `.gitignore` 忽略，不会提交）：

```bash
cat > config/smtp.local.json <<'JSON'
{
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "user": "你的邮箱@gmail.com",
  "pass": "16位应用专用密码",
  "from": "你的昵称 <你的邮箱@gmail.com>",
  "siteUrl": "https://crazyshout.github.io/paper-digest"
}
JSON
```

你也可以继续沿用环境变量方式（优先级低于本地配置文件）：

```bash
export SMTP_HOST="smtp.gmail.com"   # Gmail 推荐也可用 465 + SMTP_SECURE=true
export SMTP_PORT="587"
export SMTP_SECURE="false"          # 若改用 465，这里可设为 "true"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASS="your-16-digit-app-password"
export EMAIL_FROM="你的发件人 <your-email@gmail.com>"
export PAPER_DIGEST_SITE_URL="https://crazyshout.github.io/paper-digest"
export SMTP_REJECT_UNAUTHORIZED="true"   # 一般不需要改
export SMTP_RETRIES="2"                  # 仅对投递前的 DNS/连接故障重试
```

可选：

- `SMTP_REJECT_UNAUTHORIZED=false`：本地内网 SMTP 测试时关闭证书校验（不建议生产环境启用）。
- `EMAIL_FROM` 不设置时默认使用 `SMTP_USER`（或本地配置中的 `from`）。
- `from` 未设置且 `user` 为 `xxx@gmail.com` 时，邮件发件人会显示该邮箱地址。
- `SMTP_RETRIES` 默认为 `2`。脚本只重试明确发生在投递前的 DNS 或连接故障，避免服务端已经收信时产生重复邮件。

先验证本地配置能否完成 DNS、TLS 和 SMTP 认证；该命令不会发送邮件，也不会输出密码：

```bash
npm run email:check
```

若提示配置文件已读取、但 DNS 或网络拦截了 SMTP，请换到允许访问 `smtp.gmail.com:587`（或服务商对应端口）的执行环境后重试。受限容器或沙箱即使密钥正确，也可能禁止 SMTP 外连。

预览邮件内容：

```bash
npm run email:preview -- 2026-05-30
```

正式发送邮件：

```bash
npm run email:publish -- 2026-05-30
```

## References

- [Astro GitHub Pages guide](https://docs.astro.build/en/guides/deploy/github/)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
