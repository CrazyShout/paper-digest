# 公共周报的选文、连续阅读与覆盖检查

检查时间：2026-11-07（Asia/Shanghai）。本次只核对既有文件和仓库配置，并修改三个写作模板；未重新评审候选论文的科学结论，未改写历史检索审计，未发送邮件。

## 1. 让不同方向的读者分别受益

`config/research-interests.json` 有10个方向，其中7个 `priority=1`。这适合表达编辑关注范围，不适合替每位读者指定统一阅读顺序。原筛选规则将只报视觉质量、ADE/FDE或检测mAP而未讨论规划安全的论文列入降权项，会排除对重建、感知或基础机制读者有用的工作。

已修改[筛选规则](../../../content/templates/paper-selection-rubric.md)：分别判断思想价值与证据成熟度，以论文自身任务和主张确定需要的验证。邻域机制可作为有边界的迁移线索；主张驾驶、安全或部署改善时，仍须核对相应证据。保留来源核验、去重、质量要求及通常5–8篇的编辑规模，系统/安全视角作为选文考虑，不要求全站读者围绕同一实验任务。

当前 `content/idea-explorations/2026-11-06.json` 的24个候选确实都是 `pilot.status=not-run`。这不等于项目从未试验：`scripts/idea-pilots/` 及 `content/idea-audits/` 保留历史pilot脚本与记录。此次未改变任何Idea评分、判定或实验状态。

## 2. 把跨期变化和待跟进问题交给对应方向

最新简报已经有跨论文比较与版本/资源更新，见 `content/digests/2026-11-06.md` 的“可以放在一起讨论的问题”和“已收录论文与资源更新”。本次模板在此基础上要求解释：本方向新增什么证据、相对往期推进或修正了什么、哪一两篇适合对照，以及为什么。短评、精读报告、经典与前沿综述各有用途，跨方向阅读与Idea是可选入口。

已有待跟进事项的深度不同，后续不应混成一张“未完成实验”清单：

| 记录 | 已有阅读与去向 | 后续阅读所需的具体补充 |
| --- | --- | --- |
| Jev，`arxiv:2611.05448` | 方法III与实验IV入口已比较；因当期选文范围延期 | 语言决策专题可继续核对typed decision与预测机制；NGSIM回放的应用边界已记录 |
| LiDAR-SHIELD，`arxiv:2610.39848` | 方法III与实验V已比较，工具专报延期 | 核对接入任务、攻击范围与复用条件；工具接入数量本身不表示安全收益 |
| INTERACT，`arxiv:2611.02526` | 摘要阅读后延期 | 与RFWorld对照对象表示和蒸馏的独立贡献，尚需原文章节比较 |
| Agent-Wise Test-Time Normalization，`arxiv:2610.39505` | 摘要阅读后延期，简报称AgentNorm | 后续恶劣天气与协同感知更新中核对归一化机制和污染协作者协议 |
| SV-WAM v3、Adaptive-WAM v2、AuRaSim资源 | 已有版本或资源事件记录 | 只在实际复查后更新结论；不能把元数据变化、README或仓库按钮当完整实现发布 |

依据为[本期审计](../../../content/digest-audits/2026-11-06.json)的 `candidates`、`independentSelection`、`versionOrResourceUpdateNotes` 和简报正文。上表复述既有去向，不是本次新增论文结论。简报中的OccSplat简称未在候选标题中直接匹配；跟进时先确认canonical ID，避免用模糊简称连接错论文。

## 3. 检索计数还不能回答漏检了什么

11月6日目录相对前期新增3,977个ID，标题规则筛入380个，3,597个机械未命中。这些未命中记录仍保存在 `docs/research-updates/2026-11-06/catalog/retrieval.json` 的 `catalogCoverage.newTitleExcluded`，不是读后淘汰。将其canonical ID与最终920候选及其别名求交，得到27个由其他查询重新找回的记录；其中只有 `arxiv:2610.39505` 进入具名摘要阅读，其余26个在该期记录中仍为元数据层。

这是一个具体、可重算的标题层漏项：Agent-Wise Test-Time Normalization的标题含“Cooperative Perception”，却没有旧规则中的driving、vehicle、V2X等词；旧表达式也没有cooperative/collaborative perception。方向查询找回了它，所以不能称整条检索管线漏掉该论文。3,570个未进入最终池的记录相关性仍未知，27也不是“相关漏项总数”或召回率。

执行源也已核对：`config/research-interests.json` 已有cooperative perception和collaborative perception。11月6日的本地采集脚本 `docs/research-updates/2026-11-06/catalog/retrieve-arxiv.py:75–76` 从上期审计复制 `broadTitlePattern`，直接筛标题；到162行后才用配置关键词给已进入候选的标题/摘要生成topicHints，因此补不了前面的遗漏。该期脚本和原始retrieval文件未提交；已提交的10月28日同名脚本使用同样逻辑。当前 `scripts/`、`src/` 没有通用的标题召回函数，最终已提交审计 `queryRuns[0].searchQuery` 保留了实际旧表达式。改进应复用配置与保守通用召回规则，返回命中理由，保留语义筛选；不能只修改文字要求而继续复制过时表达式。历史脚本和审计保持不变。

最终候选的阅读深度为895个仅元数据、15个摘要层、2个方法/实验章节比较后延期、8个入选。这个分布说明台账记录了身份与去向，不等于所有候选已经接受内容质量判断。OpenAlex十查询均只取前50条；Semantic Scholar有八次429，不能解释为零进展。

已在[筛选规则](../../../content/templates/paper-selection-rubric.md)和[发布要求](../../../content/templates/publication-checklist.md)加入有边界的分层抽查与查询回归要求，复用现有审计位置。下一期可先用上述已知漏项回放标题规则，再从标题未命中、受限来源、邻域会议或综述追溯分层选样，阅读摘要并记录确切发现；发现相关项再补查询。此次没有把旧规则、旧计数或旧审批改成新结果，也没有估算全领域召回率。

## 4. 反馈与自动化按真实能力展示

`config/runtime.json` 的 `commentsEndpoint` 为空。`src/components/DigestNotes.jsx` 将内容写入浏览器 `localStorage`；现有提示已说“其他读者不可见”，但“提交评论”“还没有讨论”等标签仍可能让人误以为已发给编辑。界面宜明确称本地笔记，并单独提供公开反馈入口。

2026-11-07通过GitHub仓库元数据核实 `CrazyShout/paper-digest.has_issues=true`。已将[公开Issues入口](https://github.com/CrazyShout/paper-digest/issues/new/choose)写进发布要求，用于漏收论文、事实纠正、资源失效和阅读反馈；没有创建Issue或发送消息。用户实际提交后才能算收到反馈，目前没有可据此证明读者收益的数据。也没有每位订阅者的兴趣数据，不应自动分组邮件或推断个人方向。

仓库当前只有 `.github/workflows/deploy-pages.yml` 和 `notify-digests.yml`：入口为push、成功部署回调和手动触发。此次未在仓库中发现定时文献采集编排；外部调度未检查，不能据此断言不存在。本轮不新建采集自动化，也不为阅读体验修改重发既有简报。

三个模板的改动沿用现有全文、官方图片、独立复核、指纹、部署和通知门禁。新增验收关注不同方向的实际阅读任务，不以更多字段替代可读性。界面与最终构建由主流程统一验证。

本分片完成后执行 `npm run validate` 通过，模板diff无空白错误；未单独重复完整测试或构建，由主流程在合并界面改动后统一执行。
