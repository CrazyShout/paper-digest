# 更新论文简报说明

这个目录是论文简报的内容源。日常更新简报时，主要改这里，不需要直接改 `docs/` 里的 HTML。

## 文件放哪里

```text
content/
  README.md                 # 当前说明文件
  digests/
    YYYY-MM-DD.md           # 每期简报索引
  papers/
    paper-id.md             # 每篇论文的详细报告
config/
  research-interests.json   # 长期研究兴趣配置
```

注意：不要把说明文档或草稿 Markdown 放进 `content/digests/` 或 `content/papers/`，这两个目录下的每个 `.md` 都会被构建脚本当成正式内容读取。

## 一次更新的流程

1. 为每篇入选论文新建一个文件：

```text
content/papers/<paper-id>.md
```

`paper-id` 用英文小写、数字和连字符，例如：

```text
content/papers/driving-world-model.md
```

2. 在论文文件开头写 JSON frontmatter，下面正文写详细报告：

```md
---
{
  "id": "driving-world-model",
  "tag": "world-models",
  "title": "示例：World Models for Autonomous Driving",
  "source": "arXiv / project page",
  "authors": ["First Author", "Second Author"],
  "affiliations": ["University A", "Lab B"],
  "comment": "一句简评，说明这篇论文为什么值得组内看。",
  "visual": "visual-grid",
  "visualLabel": "world model"
}
---

## 核心问题

这里写论文解决的问题。

## 方法速读

- 方法要点 1。
- 方法要点 2。

## 组内关注点

这里写和组内方向最相关的判断。
```

字段说明：

- `id`：必须和文件名一致，不带 `.md`。
- `tag`：必须来自 `config/research-interests.json` 里的某个 `id`。
- `title`：论文标题。
- `source`：抓取来源，例如 `arXiv`、`OpenReview`、`CVF`、`project page`。
- `authors` / `affiliations`：作者和单位数组。
- `comment`：首页卡片上显示的短评。
- `visual` / `visualLabel`：当前用于占位主图样式。

3. 新建或更新当期简报文件：

```text
content/digests/YYYY-MM-DD.md
```

例如：

```text
content/digests/2026-05-18.md
```

简报文件只负责组织本期内容：

```md
---
{
  "id": "2026-05-18",
  "date": "2026-05-18",
  "title": "本期简报标题",
  "summary": "用一两句话概括本期内容。",
  "keywords": ["世界模型", "车路协同", "三维重建"],
  "papers": [
    "driving-world-model",
    "roadside-cooperative-perception"
  ],
  "notes": []
}
---

这里可以写给组内同学看的本期补充说明。
```

字段说明：

- `id` / `date`：建议都用 `YYYY-MM-DD`，左侧目录会按日期倒序显示，最新一期在最上方。
- `keywords`：显示在左侧目录里的几个核心关键词，保持简短。
- `papers`：本期包含的论文 `id` 列表，必须能在 `content/papers/` 里找到对应文件。
- `notes`：可留空数组；页面右侧评论区会显示这里的种子笔记。

4. 如果需要新增长期方向，改：

```text
config/research-interests.json
```

这里是给后续自动抓取使用的长期兴趣配置。普通每周更新通常不需要改它。首页顶部的 tag 会根据当期 `papers` 自动生成，不需要手动维护固定筛选项。

## 本地检查

更新完内容后运行：

```bash
npm run build
```

这个命令会：

- 检查 Markdown frontmatter 是否是合法 JSON。
- 检查简报引用的论文 id 是否存在。
- 检查论文 `tag` 是否存在于 `config/research-interests.json`。
- 重新生成 `docs/` 里的静态页面。

本地预览可以用：

```bash
npm run dev
```

或者直接打开：

```text
docs/index.html
```

## 发布到 GitHub Pages

确认本地构建通过后提交并推送：

```bash
git add content config docs
git commit -m "Add YYYY-MM-DD paper digest"
git push origin main
```

仓库已经使用 GitHub Actions 部署 GitHub Pages，push 到 `main` 后会自动构建并发布。Actions 页面：

```text
https://github.com/CrazyShout/paper-digest/actions
```

线上地址：

```text
https://crazyshout.github.io/paper-digest/
```

## 常见错误

- `references missing paper`：简报里的 `papers` 写了不存在的论文 `id`。
- `references missing tag`：论文里的 `tag` 不在 `config/research-interests.json`。
- `invalid JSON frontmatter`：开头 `---` 中间的 JSON 有多余逗号、缺引号或数组格式错误。
- 页面没更新：先看 GitHub Actions 是否完成，再强制刷新浏览器缓存。
