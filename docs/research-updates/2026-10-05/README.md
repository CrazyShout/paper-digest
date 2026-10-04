# 2026-10-05 简报核验记录

承接 9 月 29 日简报，实际检索在 UTC 10 月 4 日、北京时间 10 月 5 日进行。官方公告最新至 10 月 2 日，八篇首次收录均来自 9 月 30 日至 10 月 2 日公告；GeoWAM 和 MomADv2 更新原页，不重复入账。

五类目录共 7,172 次类别出现、5,525 个唯一编号。多源检索合并为 50 组查询、846 次候选出现、597 个规范候选。独立筛选阅读 597 个标题、201 份摘要，比较 20 篇候选的指定原文章节，另做两篇既有论文版本对照；没有声称通读 597 篇或复现实验。

- `digest-selection.json` 与 `selection-memo.md`：独立选择、逐条去向、真实阅读范围和冻结输入指纹。
- `author-*.json`：作者检查的原文位置、数字、公式、单位、相关工作、资源和实际看图记录。它们保留初稿指纹，修订另见 `review-corrections.json`。
- `review-policy-round1.json`、`review-representation-round2.json`、`review-assessment-round1.json`：十份新增或更新稿的最终独立复核；representation round 1 保留最初发现。
- `local-corpus-evidence.json`：十个方向的真实 `rg` 结果及逐条处置；324 条既有引用、综述正文、实质复核日期及历史站外查询未变。
- `review-integration-round1.json` 与 `final-bindings.json`：独立总审、最终正文和代码指纹。复核属于同模型家族交叉检查，不是实验复现或 Idea 通过证明。
- `figure-manifest.json`、`browser-verification.json`、`source-anchor-check.json`：19 张新增原图字节、桌面/390 像素检查、公式及原文锚点检查。
- `validation.json`、`build-verification.json`：发布前预检、内容校验、302 项测试和正式构建结果。7 项按现有条件跳过；既有测试调度器另省略一项缺少外部 pickle 前置资产的测试文件。

键盘检查发现，搜索弹窗的“查看更多结果”按钮按 Enter 会触发结果列表的全局选中事件。修复后已在真实浏览器验证分页、类型按钮、Escape 和输入框 Enter，并补上针对性测试。界面修复与内容发布分别提交。

源 PDF、HTML 和 API 原始响应留在本次临时研究目录；公开记录提供固定版本、一手 URL、查询参数、ID 清单与文件指纹。部署完成后还需核对最终提交的 Pages 工作流及线上资源，发布前记录不替代线上回执。本轮没有发送邮件。
