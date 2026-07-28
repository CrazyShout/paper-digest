# 更新论文简报说明

这个目录是论文简报的内容源。日常更新简报时，主要改这里，不需要直接改构建产物里的 HTML。

## 文件放哪里

```text
content/
  README.md                 # 当前说明文件
  idea-center.json          # 方向审计、前沿证据与可验证 Idea
  review-center.json        # 综述中心说明与写作范式
  research-landscape.json   # 首页全库趋势、热点和科研建议
  reviews/
    direction-id.json       # 每个长期方向一份持续更新的综述
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
content/templates/idea-exploration-template.md
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
- `directions` 必须覆盖 `config/research-interests.json` 中的全部方向；每个方向都要写最新趋势、现有不足、吸引人的 idea 标题、核心假设、可行方法、最小验证和相对已有工作的区别。
- 新增长期方向时要同步补充一套完整的方向 idea，不能只写“继续关注”或“建立 benchmark”这类泛化建议。
- 每条趋势、热点、立项机会和方向建议都必须提供 `evidencePaperIds`，引用 2–4 篇最直接的支撑论文，其中至少一篇来自最近 `analysisWindowIssues` 期；页面会展示论文入口，构建会校验引用、方向匹配和新鲜度。
- `updatedAt` 不能早于最新一期简报日期，否则构建会失败，避免首页继续展示已经过期的趋势判断。
- 页面统计反映本内容库的筛选结果，不代表完整领域计量，正文中不要把它外推为全体论文发表趋势。

6. 需要探索可立项 Idea 时，更新：

```text
content/idea-center.json
content/templates/idea-exploration-template.md
```

Idea 中心不是 `research-landscape.json` 的加长版。研究态势从本站内容库总结方向变化；Idea 中心必须重新检索站外一手论文和顶会前沿，依次完成意义审计、前沿检索、饱和度审计、新颖性碰撞、解法空间扩展和最小研究闭环。

更新时注意：

- 本站已总结论文只能作为检索种子，不得当作相关工作的全集。
- `directions` 必须覆盖全部长期方向；未完成审计的方向使用 `planned`，不得提前填未经验证的 Idea。
- `ready` 方向必须通过研究意义、突破余量、新颖空间和短期可行四道硬门槛。
- 必须公开检索日期、时间范围、venue、查询族、关键一手证据、高竞争区和仍有余量的失败轴。
- 每个 Idea 引用 3–5 篇最直接的一手论文，并写清每篇证据具体支持或限制什么。
- 每个 Idea 都要有可证伪假设、最小实验、定量成功标准和停止条件；不能只写方法愿景。
- 可做成度总分由统一五维权重自动复算，维度分与总分不一致时构建会失败。
- `updatedAt` 和已完成方向的 `searchedAt` 随实际复核更新，不能早于最新简报。

7. 需要维护方向综述时，更新：

```text
content/review-center.json
content/reviews/<direction-id>.json
```

综述中心面向“一个方向已经知道什么、证据在哪里、还缺什么”组织内容，而不是把本站论文卡片重新排列一遍。`content/reviews/` 必须恰好覆盖 `config/research-interests.json` 中的全部长期方向；文件名、正文 `id` 和方向 id 必须一致。

每份方向综述固定包含六类章节：`scope`、`evolution`、`taxonomy`、`evidence`、`challenges`、`outlook`。每节先提出可讨论的判断，再比较方法和证据，最后说明结论边界。参考文献同时覆盖本库报告和站外重要论文：

- 本库论文填写 `localPaperId`，标题必须与对应论文报告完全一致；页面会派生“本库已报告”标记并跳转本站详情。
- 站外论文不填写 `localPaperId`，使用 DOI、会议、期刊或 arXiv 的 HTTPS 一手链接；页面会派生“外部文献”标记并直达原文。
- 不要手填来源布尔值。本库状态以 `localPaperId` 为唯一依据；论文日后入库时补上该字段即可自动切换状态。
- 每方向至少 10 篇参考文献，并同时包含本库论文、外部论文、基础工作、近期工作、正式发表成果和至少一篇 `survey` 或 `tutorial`；具体阈值以 `config/literature-review-workflow.json` 为准。
- `publicationType` 只使用 `survey`、`tutorial`、`method`、`benchmark`、`dataset`、`standard`、`position`。
- `publicationStatus` 只使用 `peer-reviewed`、`accepted`、`workshop`、`workshop-accepted`、`preprint`、`technical-report`、`standard` 或 `dataset`。`peer-reviewed` 与 `workshop` 必须已有可核验的正式出版页；仅确认录用但正式页尚未发布时分别使用 `accepted` 或 `workshop-accepted`，并保留预印本证据边界。
- 已录用论文若同时存在正式出版页与 arXiv，`url` 应指向正式出版页。有正式 DOI 时优先使用 `doi:<id>` 作为 `canonicalId`，并在 `links` 显式加入 arXiv；没有正式 DOI 时可保留 `arxiv:<id>`，页面会自动派生 arXiv 入口。代码、项目页或其他一手入口也放入 `links: [{ "label": "...", "url": "https://..." }]`。
- `sourceFamily` 必须来自工作流允许的来源族，并记录实际用于核验的主来源，不要把搜索引擎摘要当作来源。
- 外部引用若与本库论文的规范化标题或 arXiv ID 重合会校验失败，防止同一论文被错误标成两种来源。
- `reviewedAt` 和 `searchWindow` 必须记录真实复核时间与检索范围；综述不应为了追平简报日期而虚假刷新。
- 更新前必须运行 `npm run review:preflight`，并用 `npm run review:prompt -- <direction-id>` 生成该方向的统一检索提示。提示会强制读取本机已安装的 ARIS `research-lit`、`comm-lit-review`（通信方向）和 `citation-audit` 技能。
- 每个方向必须维护可重算的 `searchAudit`：每个配置查询族恰好对应一条 `queryRuns`，保存实际查询串、族对应说明、来源、执行日期、筛入去重池的候选数、规范化 ID 样本以及 `retrieval` 中的端点、参数、排序和上限；本库宽泛检索还要分开保存 `rawHitCount`、`screenedOutCount` 和 `screeningNote`，不得把 `rg` 命中文件数当成候选数。命中且带当前方向标签的规范化论文必须完整写入 `localCandidateDisposition.candidateLocalPaperIds`，并落到最终引用或有理由的 `deferredGroups`；`retainedCanonicalIds` 必须与参考文献完全一致，站外 `excludedCandidates` 必须逐条保存一手链接、排除代码和理由。
- `sourceAttempts` 必须逐一记录本库、arXiv、正式出版源、Semantic Scholar、OpenAlex 和官方项目页的真实检索状态与采纳数。`acceptedCount` 只统计最终纳入且以该来源族核验的引用，必须与 `references[].sourceFamily` 逐源一致；聚合器只用于发现和元数据交叉核对，来源不可用时标为 `limited`，不能虚报覆盖。
- 去重键固定为 DOI、arXiv ID、正式 venue ID 和规范化标题，并在比较前统一做 Unicode 规范化、去空白和大小写折叠。计数只保留 `searchAudit.counts`；不得同时维护 `candidateCount` 等旧字段。自工作流配置的 `candidateLedgerRequiredFrom` 起，还必须逐篇保存主 canonical ID、`included` / `excluded` / `deferred` 去向、所属 `queryFamilies` 和跨查询族 `occurrences`；DOI、arXiv 与 venue 别名先归并到同一主记录，使每族 `resultCount`、候选总数和去重总数都能由台账重算。
- 检索分片只负责扩大覆盖，最终结论必须经过未参与撰写的独立复核；复核完成前保持 `independentReview.status: "pending"`，不得机械改为通过。通过后必须记录当前综述内容的 `snapshotFingerprint`，之后任何正文、引用或检索审计修改都会使旧通过记录失效。
- 每条参考文献必须记录 `authors`、`publicationStatus`、`canonicalId`、`supports` 和 `limitation`；不得把搜索结果摘要或二手解读当作论文证据。
- 每次终审必须逐项执行 `content/templates/review-quality-checklist.md`，尤其核对查询族错位、Workshop 状态和实物/实车实验的访问权限、平台尺度、环境及重复次数。
- `config/literature-review-workflow.json` 定义最低覆盖与动态更新期限，构建校验会阻止来源过窄、基础/近期文献失衡或证据元数据不完整的综述发布。

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
- 检查首页研究态势是否覆盖全部方向，tags 和证据论文是否有效，并确保至少引用一篇近期论文。
- 检查 Idea 中心是否覆盖全部方向、通过准入门槛、使用可核验一手证据，并保证评分可复算。
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
