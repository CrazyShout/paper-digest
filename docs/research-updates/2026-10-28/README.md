# 2026-10-28 检索、写作与复核记录

本期承接 2026-10-23，重点检查 10 月 24–28 日公开进展，提交查询重叠至 10 月 21 日。期号采用 Asia/Hong_Kong；请求回执保留实际 UTC 时间，不将当天后续尚未公开的资料算入覆盖范围。

- `arxiv-retrieval.json` 与验证记录：六目录完整分页、上期快照差分、十方向查询、267 个候选的完整元数据。目录缺失和近期公告中的旧身份另行说明；下载不计阅读。
- `source-retrieval.json`、`source-primary-evidence.json`：正式出版源、官方项目页、Web、OpenAlex 与 Semantic Scholar 的实际尝试及原始命中，保留限流和访问限制。
- `selection-reading-ledger.json`、`selection-reasons.json`、`selection-aliases.json`：父角色独立筛选的实际阅读深度、逐项去向和身份归并；正式台账在 `content/digest-audits/2026-10-28.json`。
- `prior-version-scan.json`、`tracked-release-checks.json`、`additional-resource-events.json`：182 个既有 arXiv 身份和 40 个 GitHub Release 接口的检查。CooperScene 仅作正式记录更新；资源更新时间不等于代码、数据或权重发布。
- `author-*.json`：方法、实验、相关一手来源、资源与实际官方图片的作者核对，以及论文/公开实现不一致的记录。
- `review-*.json`：未参与对应报告撰写者的核对、发现、修正和最终意见。同模型家族复核记为 `same-family provisional`，不代表外部同行评审或实验复现。
- `prompts/`、`local-corpus-evidence.json`、`maintenance-scope.json`：本库候选更新及日期边界。原站外检索、参考文献与实质复核日期保留；Idea 不产生新的通过判定。
- `final-bindings.json` 与验证记录：最终获审文件指纹、构建和浏览器验收。

原始 HTML、PDF、请求正文与辅助提取在 `/tmp/paper-digest-20261028/`；公开记录保存端点、参数和哈希。本地缓存不是长期发布承诺。脚本用于复现处理过程，其中写入审批/生产内容的步骤不能在发布后无检查地重跑。

邮件在对应提交的 Pages 部署与线上比对通过后，由受保护通知工作流发送。本轮旧报告内容版本不变，通知仅针对新增期号。订阅地址、凭据和明文回执不在此目录；发布结果保存在忽略的同级 `2026-10-28-release/` 目录和 GitHub 加密账本。
