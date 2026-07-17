# 更新论文简报说明

这个目录是论文简报的内容源。日常更新简报时，主要改这里，不需要直接改构建产物里的 HTML。

## 文件放哪里

```text
content/
  README.md                 # 当前说明文件
  research-landscape.json   # 首页全库趋势、热点和科研建议
  digests/
    YYYY-MM-DD.md           # 每期简报索引
  papers/
    paper-id.md             # 每篇论文的详细报告
config/
  research-interests.json   # 长期研究兴趣配置
```

注意：不要把说明文档或草稿 Markdown 放进 `content/digests/` 或 `content/papers/`，这两个目录下的每个 `.md` 都会被构建脚本当成正式内容读取。

历史已收录论文统一维护在：

```text
content/reported-papers.md
```

生成新简报前必须先按 arXiv ID 或论文标题查这个文件。已经出现过的论文不要再次放进新简报；如果新论文入选，需要同步新增一行。

## 一次更新的流程

开始写正式简报前，先按模板和筛选规则统一口径：

```text
content/templates/paper-report-template.md
content/templates/paper-selection-rubric.md
content/templates/digest-template.md
```

论文详细报告建议保持相同叙述骨架，避免每期、每篇的分析颗粒度漂移。筛选时优先保留和 `config/research-interests.json` 明确匹配、来源可核验、实验有闭环或真实数据支撑、能形成后续讨论的问题导向论文。单篇详细报告必须放入至少 1 张论文原图、官方项目图或 arXiv source/PDF 提取图；优先放 2 张，并在正文里解释图片支撑的结论。

作者单位必须从论文 PDF 首页、arXiv source、项目页或会议页面核验后填写。不要使用“作者单位见论文 PDF”“unknown”“not confirmed”这类占位。arXiv API 通常没有 affiliations；如果 API 没给单位，需要继续查 PDF/source。

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
- `affiliations`：必须是已核验的真实单位，不能写占位。单位来自 arXiv source/PDF 时按论文作者区块原文归并即可。
- `comment`：首页卡片上显示的短评。
- `revisionOf`：可选，仅用于保留原报告并新增人工修订版。修订版文件可以复用同一篇论文的标题和 arXiv ID，但必须指向原始论文 `id`，且不写入去重台账。

图片要求：

- 每篇论文报告至少 1 张官方图片，优先 2 张。
- 优先使用 arXiv HTML、论文项目页或会议页面上的图片 URL。
- 如果没有可直接引用的 HTML 图，从官方 PDF/source 提取图片到 `public/assets/papers/<paper-id>-figure-1.png`，并在论文详情页中用 `../../assets/papers/<paper-id>-figure-1.png` 引用。
- 不要用无来源截图、二次摘要站图片或和论文不对应的占位图。

去重要求：

- 新论文的 arXiv ID 不能已经出现在 `content/reported-papers.md`。
- 新论文标题不能和 `content/papers/` 里已有报告标题等价或只做轻微改写。
- 同一篇论文只能出现在一个简报里；跨方向展示请用单个报告文件的 `tags` 数组，不要复制成多个 paper id。
- 若是为了对照保留的修订版，文件名建议使用 `<paper-id>-gpt.md`，并在 frontmatter 中设置 `revisionOf`。

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
  "displayDate": "2026-05-18 (optional-label)",
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

- `id`：必须和文件名一致。常规日报使用 `YYYY-MM-DD`；同日期对照版可使用 `YYYY-MM-DD-gpt` 这类后缀。
- `date`：必须是文件名开头的 `YYYY-MM-DD` 日期；左侧目录会按日期倒序显示，最新一期在最上方。
- `displayDate`：可选，仅用于页面显示，例如标记测试来源；不要用它替代 `id` / `date`。
- `keywords`：显示在左侧目录里的几个核心关键词，保持简短。
- `papers`：本期包含的论文 `id` 列表，必须能在 `content/papers/` 里找到对应文件。
- `notes`：可留空数组；页面右侧评论区会显示这里的种子笔记。

4. 如果需要新增长期方向，改：

```text
config/research-interests.json
```

这里是给后续自动抓取使用的长期兴趣配置。普通每周更新通常不需要改它。首页顶部的 tag 会根据当期 `papers` 自动生成，不需要手动维护固定筛选项。

5. 每次形成一批正式简报后，复核首页研究态势：

```text
content/research-landscape.json
```

这个文件只维护需要人工判断的内容：全库总判断、趋势解释、热点、可立项问题，以及每个长期方向的焦点、缺口和建议。方向论文数、全库覆盖率、最近三期与此前三期的变化、交叉论文数量由构建代码从 `content/papers/` 和 `content/digests/` 自动计算，不要手填。

更新时注意：

- `updatedAt` 改成实际复核日期。
- `trends` 解释跨期变化，避免把单篇论文写成领域趋势。
- `hotspots` 至少关联两个方向，交叉论文数会自动显示。
- `opportunities` 必须同时写研究问题、为什么现在、最小可行实验和主要风险。
- `directions` 必须覆盖 `config/research-interests.json` 中的全部方向；新增长期方向时要在这里同步补充分析。
- 页面统计反映本内容库的筛选结果，不代表完整领域计量，正文中不要把它外推为全体论文发表趋势。

## 本地检查

更新完内容后运行：

```bash
npm run build
```

这个命令会：

- 检查 Markdown frontmatter 是否是合法 JSON。
- 检查简报引用的论文 id 是否存在。
- 检查论文 `tag` / `tags` 是否存在于 `config/research-interests.json`。
- 检查 digest 日期是否是 `YYYY-MM-DD`，且 `id`、文件名和 `date` 一致。
- 检查 arXiv ID、论文标题和 digest 引用是否重复。
- 检查 `content/reported-papers.md` 是否和当前内容一致。
- 检查论文 frontmatter 的作者、单位、关键词、notes 等 UI 依赖字段类型。
- 检查新论文是否缺少图片，或是否使用“作者单位见论文 PDF”等占位单位。
- 检查常见 arXiv HTML 图片路径错误。
- 检查首页研究态势是否覆盖全部方向，热点和课题建议引用的 tags 是否有效。
- 重新生成 `dist/` 里的静态页面。

本地预览可以用：

```bash
npm run dev
```

或者直接打开：

```text
dist/index.html
```

## 发布到 GitHub Pages

确认本地构建通过后提交并推送。仓库已经使用 GitHub Actions 部署 GitHub Pages，push 到 `main` 后会自动构建并发布；不需要再提交 `dist/` 或旧的 `docs/` 构建产物。提交内容通常是：

```bash
git add content config src public scripts package.json package-lock.json
git commit -m "Add YYYY-MM-DD paper digest"
git push origin main
```

Actions 页面：

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
- `duplicate arXiv id` / `duplicate paper title`：候选论文已经收录过，需要换论文。
- `appears in multiple digests`：同一篇论文被放进多个简报，应该只保留第一次收录。
- `reported-papers.md ... expected`：去重台账没有同步更新。
- `must use verified affiliations`：论文单位仍是占位，需要从 PDF/source/项目页核验后填写。
- `must include at least one official figure image`：论文报告缺少官方图片，需要补 arXiv HTML/项目页图片，或从官方 PDF/source 提取到 `public/assets/papers/`。
- 页面没更新：先看 GitHub Actions 是否完成，再强制刷新浏览器缓存。
