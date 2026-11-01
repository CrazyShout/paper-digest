# 4D Gaussian 专题检索分片（2026-11-01）

检索者只提供候选，不决定最终入选或质量排名。`query-runs.json` 记录 4 条 arXiv 查询、3 条 OpenAlex 查询及 3 次 S2 429；原始 350 条返回记录在 `raw-search-entries.json`。这些查询是专题补充发现，不冒称完成两份综述全部配置查询族；它们的筛选候选数留给父流程逐项审阅后确定。

arXiv 每条只取 submittedDate 降序前 50 条，OpenAlex 每条取相关性前 50 条并限制 2023-01-01 至 2026-11-01；结果上限和 Gaussian 物理学等歧义使召回不完备。禁止把原始命中数当作全文阅读或排除数。`candidate-evidence.json` 给出 14 个具名候选的题名、摘要、实际阅读深度；父流程负责最终 disposition。缓存下载与本文阅读严格区分。

基础论文 2310.08528 和 2310.10642 的初始 HTML 下载固定 v1，仅作发现缓存，最终报告必须使用父流程核定的正式版本，不能把 v1 数字当最终稿。2412.20720 是 Yang 原生 4DGS 的扩展版，不能混用作者名单。旧 Fudan 项目页已跳转到 LogosIntelligenceLab 项目页。

已收录 Envision4D、DeSiRe-GS、Instant NuRec、DUST、物理4D重建、Real2Sim 等不作为新单篇。FL4N 摘要明确不用显式4D primitives，属于邻接表征对照。GaussianSpline、DynStream、TETRIS-4DGS、HiQGS 可为拓展脉络，尚未完成全文比较，不能以质量低作为排除理由。

`normalize-raw-candidates.mjs` 将 350 次原始返回归为 321 个规范化标题组，保留全部查询出现记录与别名，包含 29 次重复出现、24 个跨查询组。`normalized-raw-candidates.json` 的 DOI/arXiv 合并依据相同规范化标题，接受前仍应核对一手身份；它不是已读论文清单或最终候选数。OpenAlex 的倒排摘要已恢复为可读文本，是否阅读与最终筛选由主编另外记录。

检索者后来获授权撰写 Drive2Gauss 和 SplatFlux 两篇。`author-evidence-drive2gauss-splatflux.json` 单独记录实际阅读范围、两篇报告指纹、四张原图指纹与逐张查看结果；作者核验不能作为独立通过记录。Drive2Gauss 完整数据、权重的直接访问失败，已核实官方仓库文档、源码与样例 Release；SplatFlux 官方页未找到代码、配置、权重或整合数据发布。

专题分类快照另见 `category-snapshots.json`：查询使用 cs.CV 或 cs.GR 与 Gaussian 关键词交集，不能称为完整类别目录。cs.CV 全日期查询头返回 3392 条且传输超时，保留该失败响应，再限定 2026 年重新获取；cs.GR 全日期关键词结果为 681 条。每页记录真实请求、时间、原始 SHA-256、totalResults 与返回数量，`completeForQuery` 为真才算该查询范围内完整。此快照与前述 350 条发现样本分开计数，不因此增加阅读数量。
