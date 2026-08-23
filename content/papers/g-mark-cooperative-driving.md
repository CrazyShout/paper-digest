---
{
  "id": "g-mark-cooperative-driving",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving", "agentic-driving"],
  "title": "G-MARK: Grounded Multi-Agent Reasoning for Cooperative Driving via Knowledge Graphs",
  "source": "ICMLA 2026 oral (accepted; formal paper page unavailable at scan time) / arXiv:2608.19964 / https://arxiv.org/abs/2608.19964 / HTML: https://arxiv.org/html/2608.19964 / Code: https://github.com/bhavyagupta98/g-mark",
  "authors": ["Bhavya Gupta", "Onat Gungor", "Tajana Rosing"],
  "affiliations": ["University of California, San Diego", "West Virginia University"],
  "comment": "G-MARK 不传 dense feature 或长文本，而把来源、可见性、不确定性、冲突和路径相关性保存在可追溯知识图谱中；在真实 V2V 数据衍生任务上显著改善遮挡推理，并把结构化通信量降到 V2V-GoT 的约 1/25.6。"
}
---

## 一句话定位

G-MARK 的价值不在“知识图谱”这个名词，而在于它把协同消息从一个被过早融合的对象状态，改造成带 provenance、ego/partner visibility、uncertainty 和 disagreement 的证据账本；不同任务按需查询同一账本，在遮挡推理上明显获益，同时保留低通信量和可追溯性。

## 论文要解决的问题

协同感知的中间特征融合通常带宽高且难解释，语言化协同虽然能回答复杂问题，却可能把数值几何转成冗长文本并丢失来源。更根本的问题是，多车对同一目标的观测若在入口处就折叠为单一状态，后续模型无法回答“谁看见了它”“是否只由 partner 支持”“两车是否冲突”，也无法针对遮挡、运动和控制任务选择不同证据。

作者因此把 processed cooperative perception artifacts 映射成 provenance-aware KG，并在 V2V4Real 衍生的 V2V-GoT-QA 上同时评价对象选择、可见性、运动、控制和未来轨迹。论文关注的是协同证据如何进入推理，而不是重新训练前端检测器。

## 方法和系统设计

- KG 节点和边保存目标框、置信度、来源车辆、支持数量、ego/partner 可见性、弱候选、跨车冲突、历史运动及相对规划路径的位置。
- 同一图谱导出三类 typed view：对象检索用于 Q1-Q4，规则化回归用于 Q5/Q7/Q9，场景动作预测用于 Q6/Q8；任务头是 logistic regression、regularized regression 和轻量分类器。
- 系统传输 compact KG evidence，而不是 dense feature 或自然语言中间推理；训练使用约 11 万问题，验证集约 3.1 万问题，CPU 环境即可运行。

## 关键图与可视化结果

![图 1：G-MARK 从多车处理后观测构建带来源和可靠性属性的共享知识图谱](https://arxiv.org/html/2608.19964v1/gmark_arch.png)

图 1 展示 delayed evidence fusion 的核心：多观察者证据先保留分歧与来源，任务头再读取适合自己的图谱视图。它支持可审计协同推理，但也暴露出论文依赖上游已经生成可靠对象框和轨迹上下文。

![图 2：未来轨迹误差与每样本通信量的权衡](https://arxiv.org/html/2608.19964v1/gmark_comm_vs_l2_tradeoff.svg)

图 2 说明 G-MARK 的目标不是在单一轨迹误差上压过所有模型，而是换到低带宽 operating point：通信量显著下降，轨迹精度接近语言协同基线。它不能证明完整 V2X 链路带宽或端到端时延，因为比较从 processed artifacts 之后开始。

## 实验结论与证据

相对 V2V-GoT，G-MARK 在九项任务中八项改善：遮挡对象 F1 从 0.301 到 0.428，提升 42.2%；partner-only 隐藏目标 F1 从 0.440 到 0.494；两项 object motion L2 分别由 8.050/7.610 降到 3.822；控制 Action L1 从 0.088 降到 0.076。未来轨迹是唯一退步项，平均 L2 为 2.710 m，而 V2V-GoT 为 2.620 m，说明长时误差仍会积累。

每样本结构化通信量为 0.0159 MB，约比 V2V-GoT 低 25.6 倍；task solver 本身低于 1.4 ms，六类任务低于 1 ms。去掉 partner evidence 后隐藏目标 F1 直接从 0.494 降到 0；去掉 provenance 后降到 0.396，控制误差升到 0.152。这些消融较有力地证明收益来自协同来源结构，而不是换了一个分类头。

## 应用场景与启发

- 应用场景：带宽受限 V2X、协同危险目标解释、消息审计、边缘端结构化场景共享和任务按需通信。
- 方法启发：不要让 occupancy 或 object track 在进入协同模块时丢掉 observer provenance；分歧本身可能是遮挡、标定或欺骗的重要信号。
- 研究启发：把 KG 中的离散候选和不确定性换成可校准的概率 occupancy，再用规划损失决定应请求哪辆车的哪类证据。
- 讨论问题：图谱提供可解释结构后，如何保证其结构化字段不是由错误前端生成的“精确幻觉”？

## 局限与阅读风险

实验基于 V2V4Real 的处理后感知产物和 QA 任务，没有把网络丢包、时钟误差、定位漂移及检测前端时延纳入端到端链路。主要比较采用 V2V-GoT 报告结果，而非所有基线在完全相同实现下重跑。当前任务头很轻，证明了结构化证据有效，却没有证明知识图谱优于强神经融合器；未来轨迹还略差，且没有闭环驾驶或安全终点。ICMLA 2026 oral 状态来自 arXiv 作者声明，扫描时尚无可核验的正式论文页，因此保留 arXiv 为论文入口并明确标为 accepted，而不写成已正式出版。

## 后续跟进

- 用代码重建 provenance、partner removal 和 unstructured-object 三组关键消融。
- 在延迟、丢包、姿态偏差和恶意 partner 下检查 conflict 字段是否真的能触发拒绝融合。
- 将结构化 evidence payload 接入真实协同规划器，按 collision、progress 和通信预算联合评价。
