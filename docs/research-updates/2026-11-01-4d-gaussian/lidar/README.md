# LiDAR 异常分割综述实质复核 · 2026-11-01

撰写与原始取证：`/root/refresh_lidar_nov01`。新增核心引用和后续候选的取舍：`/root`。当前综述状态为 **pending**，作者核查不代替独立终审。

## 本轮改动

- 重新打开16条既有引用的正文与书目入口，逐条核对当前使用的机制、数值、协议和限制；完整记录见 `reference-verification.json`。读深度为与当前论断相关的全文段落，不声称逐页穷尽阅读。
- 加入 root 独立批准的 DriveOSS 与 TriO。DriveOSS 补充多天气与已知语义约束；TriO 作为占据/地面分离的道路障碍邻域，单列其 STU 负点/正点跨划分、前视视场及无 RADAR 的实验条件。
- STU 两评测器均在2.5–50m内统计，剩余异常点不足5时跳过整帧。DriveOSS 的异常路径有同类跳帧，语义/开放集路径没有这一条件；两路径都有距离过滤。上述判断来自重新取得的作者代码，blob SHA 与解码后 SHA-256 已记录。
- DriveOSS 的测试 FPR95 与验证集定阈值的开放集指标分开；mOpenIoU 为19个已知类的均值，outlier IoU 另报。README截至本次读取仍标完整数据和预训练模型待发布，隐藏测试由作者接收预测。
- DOODLE 已读完整正式PDF。补充最小40点簇和表5所报0.7655秒，保留目标硬件复测条件；不继续把推理时长说成未经核查。代码目录仍只有README。
- COVAL 的 PMLR 正式出版页已取得，纠正旧检索缺口；全文下载的TLS失败/404不作阅读证据，仍不进入核心比较。ULOPS及另外6条直接或边界邻域保留明确的后续去向，均不以“质量低”淘汰。

## 检索与计数

六类查询均于2026-11-01执行，保留每族独立网页响应。其后重开既有一手种子并结合API发现；`resultCount`是这些范围筛选后的论文候选，**不是**搜索引擎总命中数。`primarySeedCanonicalIds`明确回溯来源，避免把重新打开的旧引用冒充新查询发现。

最终台账：42次跨查询族出现、27个规范化候选、18条核心引用、9条未进入核心的候选。5个本库方向候选全部被18条引用覆盖。原始Markdown的路径与标签筛选见 `local-query.json`，API的30条arXiv项和20条OpenAlex项逐条范围筛选见 `api-scope-screening.json`。Semantic Scholar实际返回429，采纳0条；聚合器没有被用作结论来源。

原始获取状态见 `primary-fetch.json`、`html-fetch.json`、`gap-fetch.json`；后者的首次APF下载超时，其续传后的4809295字节完整PDF已解析为10页，最终文件指纹在 `completed-gap-files.json`。DOODLE完整PDF为11页。失败或截断文件未计为全文阅读。完整下载文件仅作本地核查，`primary/`被本目录忽略；保留可追溯URL、状态、指纹和作者核查摘要。

原综述完整快照保存在 `review-before.json`，未回填历史审核。生产综述的 `reviewedAt` 和本次检索截止日更新至2026-11-01；旧日期仍存在原快照中。

## 自检与交接

已按 `content/templates/review-quality-checklist.md` 检查查询语义、来源尝试、canonical去重、本库闭合、正式/预印本入口、任务与物理证据边界。

`npm run validate`已运行。LiDAR文件仅剩等待独立审核的门禁：pending状态及审阅人/日期/轮次字段尚未填写；当前无LiDAR引用标签、查询计数或候选闭合错误。全仓其他失败来自并行编写中的新报告、简报接线和其他综述，保留在 `validate-pending.log`，本子任务不修改那些文件。

独立审阅者需要重新读取生产JSON及本目录核查资料，重点检查STU/DriveOSS代码路径差异、TriO协议、数值单位、资源状态与候选计数。通过后由审阅者绑定 `reviewSnapshotFingerprint`；作者未签署通过。后续如报告语料继续变化，父流程需重跑本库查询并更新审核指纹。
