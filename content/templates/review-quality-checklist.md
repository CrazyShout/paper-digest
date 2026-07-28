# 动态综述终审清单

本清单记录 2026-07-28 全方向复核中暴露的常见失效模式。每次刷新方向综述时，先执行检索，再逐项核对，最后才填写 `independentReview`。

## 检索与去重

- 查询串、候选 ID 和 `family` 必须语义一致。查询错位时重新执行或重建记录，不能只改标签。
- 本库检索必须保存真实可执行的 `rg` pattern、path 和 flags；不要在本地检索记录里使用 `site:` 等 Web 搜索语法。
- 本库宽泛 `rg` 命中数是 `rawHitCount`，逐篇核对方向、文档类型和 canonical ID 后进入跨源去重池的才是 `resultCount`；同时保存 `screenedOutCount` 与 `screeningNote`，两种计数不得混用。
- 本库命中且带当前方向标签的规范化论文必须完整列入 `candidateLocalPaperIds`，并逐篇落到最终引用或 `deferredGroups`；直接相关与跨方向补充证据分组记录，不允许静默漏筛。
- 本库、arXiv、正式出版源、Semantic Scholar、OpenAlex 和官方项目页都要记录真实尝试、端点、参数、排序、结果上限、状态和采纳数。
- `sourceAttempts.acceptedCount` 只统计最终纳入且以该来源族核验的引用，必须与 `references[].sourceFamily` 逐源对账；它不是原始命中数或进入去重池的候选数。
- Semantic Scholar/OpenAlex 只用于发现、作者机构和出版元数据交叉核对；论断仍回到论文、正式出版页、标准或官方项目页。
- canonical ID 先做 Unicode 规范化、去首尾空白和大小写折叠，再检查引用、保留、排除和查询样本之间的重复与交集。
- 检索计数只保留 `searchAudit.counts`。删除 `candidateCount`、`deduplicatedCount`、`includedCount`、`excludedCount` 等旧字段。
- 自 `config/literature-review-workflow.json` 的 `candidateLedgerRequiredFrom` 起，逐篇保存去重后的 canonical ID、最终去向、所属 `queryFamilies` 和跨查询族出现次数；每族台账行数必须重算出对应 `resultCount`，`occurrences` 总和必须等于候选记录数，台账行数必须等于去重数。DOI、arXiv 和 venue ID 要先映射到同一主记录；重复候选至少要以任一别名在两个查询样本中显式出现，不能靠无法复核的减法猜去重数。

## 书目与证据

- 用一手页面核对标题、完整作者、年份、venue、DOI/arXiv ID 和出版状态。
- `workshop`、`workshop-accepted`、`preprint`、`accepted`、`peer-reviewed`、`standard` 分开记录。`peer-reviewed` 与 `workshop` 必须已有可核验的正式出版页；仅确认录用但正式页尚未发布时分别使用 `accepted` 或 `workshop-accepted`，不能写成已正式出版。
- 已录用论文若同时存在正式出版页与 arXiv，必须保留两个可点击入口：`url` 指向正式版；有正式 DOI 时用 DOI 作为 `canonicalId` 并在 `links` 显式保留 arXiv，没有正式 DOI 时可保留 arXiv canonical ID 由页面自动派生入口。不得用正式版覆盖或删掉预印本入口。
- 链接类型必须由真实 URL 主机名派生，不能相信手写标签；正式来源只接受精确主机或合法子域，拒绝 `official.example.evil.test` 这类相似后缀。只要记录了正式出版入口，就必须把它放在主 `url`，不能让 arXiv、代码或项目页占据主链接。
- 每条 `supports` 只写论文直接支持的结论；`limitation` 写明协议、数据、时域、平台、样本量和外推边界。
- 涉及“实物”“实车”“真实部署”时，必须写明平台尺度、输入/模型写权限、攻击载体、环境、路线或场景、重复次数、控制接口、对照和开放道路适用性。
- 数字输入注入、小型机器人赛道、封闭场地全尺寸车辆和公共道路车队是不同证据等级，不能用同一个“实车验证”概括。

## 综合与终审

- scope、evolution、taxonomy、evidence、challenges、outlook 各自承担不同功能；演化时间线必须包含改变范式的正式工作。
- 把视觉质量、感知一致性、反应性、闭环、硬件在环和真实道路证据分栏，不用单一总分跨协议比较。
- 研究建议必须可证伪，写出基线、干预、主要终点、失败阈值、回退条件和适用包络。
- 批量修改综述 JSON 时必须以唯一 `id` 定位记录，修改后重新列出 `id → publicationStatus/canonicalId/url` 映射核对；不得只按会重复出现的字段值做无上下文替换。
- 独立审阅者必须重新读取当前修订快照，并明确返回 PASS 或新的具体阻断项。通过后把排除 `independentReview` 元数据计算出的 SHA-256 写入 `snapshotFingerprint`；任何正文、引用或检索审计变化都会使旧通过记录失效。不得把 `pending` 状态本身循环当作内容缺陷。
- 只有事实、覆盖、结构、可读性、验证器和部署门禁全部通过后，才把 `independentReview.status` 改为 `passed`。
