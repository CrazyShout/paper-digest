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

开始写正式简报前，先按模板和筛选规则统一口径：

```text
content/templates/paper-report-template.md
content/templates/paper-selection-rubric.md
content/templates/digest-template.md
```

论文详细报告建议保持相同叙述骨架，避免每期、每篇的分析颗粒度漂移。筛选时优先保留和 `config/research-interests.json` 明确匹配、来源可核验、实验有闭环或真实数据支撑、能形成后续讨论的问题导向论文。单篇详细报告应尽量放入论文原图、官方项目图或可视化结果，并在正文里解释图片支撑的结论。

1. 为每篇入选论文新建一个文件：

```text
content/papers/<paper-id>.md
```

`paper-id` 用英文小写、数字和连字符，例如：

```text
content/papers/example-world-model.md
```

2. 在论文文件开头写 JSON frontmatter，下面正文写详细报告：

```md
---
{
  "id": "example-world-model",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving"],
  "title": "示例：World Models for Autonomous Driving",
  "source": "arXiv / project page",
  "authors": ["First Author", "Second Author"],
  "affiliations": ["University A", "Lab B"],
  "comment": "两句话以内说明论文内容简介、应用场景或为什么值得读。"
}
---

## 一句话定位

这里写论文属于什么问题、核心新意和入选判断。

## 论文要解决的问题

这里写任务背景、已有方法短板和真实痛点。

## 方法和系统设计

- 方法要点一。
- 方法要点二。

## 关键图与可视化结果

![图 1：一句话说明图片内容](https://example.com/official-paper-figure.png)

这里解释图片展示了什么，以及它支撑或没有支撑什么结论。

## 实验结论与证据

这里写数据集、指标、对比对象和证据链。

## 应用场景与启发

这里写可能应用、方法启发和组会可讨论问题。
```

字段说明：

- `id`：必须和文件名一致，不带 `.md`。
- `tag`：主方向，必须来自 `config/research-interests.json` 里的某个 `id`。
- `tags`：可选数组，用于跨方向论文；数组里的每个 id 都必须来自 `config/research-interests.json`。如果省略，构建脚本会退回使用 `tag`。
- `title`：论文标题。
- `source`：抓取来源，例如 `arXiv`、`OpenReview`、`CVF`、`project page`。
- `authors` / `affiliations`：作者和单位数组。
- `comment`：首页卡片上显示的短评。

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
    "example-world-model",
    "example-roadside-perception"
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
- 检查论文 `tag` / `tags` 是否存在于 `config/research-interests.json`。
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
- `references missing tag`：论文里的 `tag` 或 `tags` 不在 `config/research-interests.json`。
- `invalid JSON frontmatter`：开头 `---` 中间的 JSON 有多余逗号、缺引号或数组格式错误。
- 页面没更新：先看 GitHub Actions 是否完成，再强制刷新浏览器缓存。
