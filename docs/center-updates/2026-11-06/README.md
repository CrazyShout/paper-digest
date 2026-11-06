# 2026-11-06 研究中心更新

本轮更新十篇方向综述和 Idea 中心。综述现有 391 条方向内引用记录；新研究探索包含 24 个候选、62 个来源，独立比较建议 7 项优先试验、16 项继续展开，1 项合并同组实验而暂存。所有实验均为计划，未运行模型。

当前探索使用 research-lit、comm-lit-review（协同方向）、idea-creator、novelty-check 和 research-review。两个生成者分别展开候选，再由未参与检索及撰写的评审者查新与比较。相邻工作、实现工作量和未运行的假设不自动导致淘汰。历史可见的 26 个候选、评分和判定保持原样；早期盘点的 29 个为计数误差，见 legacy-count-correction.json。

- `generation-astra.json`、`generation-sol.json` 与 `candidate-union.json` 保存原始方案；`generation-input-manifest.json` 记录冻结输入指纹。含原文片段的输入包仅在本地保留。
- `idea-comparison/recommendations.json` 保存逐项判断；`final-content-review.json` 绑定最终文献阶段内容，原需要修订的记录继续保留。
- `independent-review/` 保存十篇综述的论断检查及后续元数据兼容复核。当前审批路径见各综述的 independentReview；原轮次不回写。
- `retrieval-manifest.json` 保存实际查询、计数、来源尝试和来源文件指纹。候选出现次数包含明确区分的旧书目种子与补检，不等于新论文数或全文阅读量。公开摘要或标准范围足以支撑的论断按其实际深度记录。
- `checks-summary.json` 与 `final-bindings.json` 记录验证及最终文件；浏览器检查包含桌面、390 px、方向切换、当前/历史深链接、搜索、键盘和打印。

阅读界面把当前方法与首试放在前面，详细比较和历史记录可展开，搜索与打印仍包含完整阅读内容。正式录用状态与已核实出版页分别记录。

本轮没有修改简报、单篇报告、原图或订阅名单。部署后应由既有保护流程确认版本已发送而跳过广播；不直接发送邮件。

原始网页响应、全文缓存、截图、PDF 和本地操作日志不会作为公开原文资料提交。独立审阅属于同模型家族的 provisional review，不等于模型实验复现或人为终审。
