---
{
  "id": "mdrive-closed-loop-cooperative-driving",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving", "vehicle-road-cooperation", "end-to-end-autonomous-driving", "autonomous-driving-testing"],
  "title": "MDrive: Benchmarking Closed-Loop Cooperative Driving for End-to-End Multi-agent Systems",
  "source": "arXiv:2605.10904 / https://arxiv.org/abs/2605.10904",
  "authors": ["Marco Coscoy", "Zewei Zhou", "Seth Z. Zhao", "Henry Wei", "Angela Magtoto", "Johnson Liu", "Rui Song", "Walter Zimmer", "Zhiyu Huang", "Chen Tang", "Bolei Zhou", "Jiaqi Ma"],
  "affiliations": ["University of California, Los Angeles"],
  "comment": "MDrive 把 V2X 协同驾驶评测推进到闭环 multi-agent benchmark，重点检验感知共享和协商机制是否真的转化为规划收益。"
}
---

## 一句话定位

MDrive 是一篇闭环协同驾驶 benchmark 论文。它不只问多车和 V2X 是否能提升感知，而是把 connected agents 放进 225 个基于 NHTSA pre-crash typologies 和真实 V2X 数据的闭环场景中，评估 perception sharing、negotiation 和 end-to-end multi-agent policy 对最终驾驶行为的影响。

## 论文要解决的问题

V2X 论文常见评测缺口是开环指标和真实闭环驾驶之间脱节。感知共享可能让检测更准，但不一定让规划更安全；多智能体协商可能在简单场景里帮助让行，却可能在密集交通中引入额外不稳定性。MDrive 的问题是：如何构建一个可复现的闭环基准，直接评估协同机制对规划、交互、多样场景和鲁棒性的收益与副作用。

## 方法和系统设计

- Benchmark 包含 225 个闭环协同驾驶场景，来源结合 NHTSA 预碰撞类型和真实 V2X 数据，覆盖行为和交互多样性。
- 评测对象包括 single-agent 与 multi-agent 系统，重点比较 perception sharing 和 negotiation 对闭环规划结果的影响。
- 工具箱包含 scenario generation、Real2Sim conversion 和 human-in-the-loop simulation，目标是让协同驾驶评测可扩展、可复现。

## 关键图与可视化结果

![图 1：MDrive 总览，展示三类 benchmark 场景、Real2Sim/agentic scenario generation/human-in-the-loop toolbox 和闭环协同评测目标](../../assets/papers/mdrive-teaser.png)

这张图来自 arXiv source 中的官方 teaser。它说明 MDrive 的核心不是单一模型，而是把真实 V2X 日志重建、agentic 场景生成和人工接管仿真组合成闭环协同驾驶 benchmark。

![图 2：MDrive 按场景类别统计 Driving Score 和 Success Rate 的 harmonic mean](../../assets/papers/mdrive-benchmark-across-categories.png)

这张图支撑论文对闭环评测的主张。阅读时要看不同模型在不同交互类别上的差异，而不是只看平均分，因为协同感知和协商机制的收益会随场景复杂度变化。

## 实验结论与证据

摘要给出的主要结论是 multi-agent 系统一般优于 single-agent counterpart，但收益并不单调。Perception sharing 会增强感知，却不总能转化为更好的 planning；negotiation 能提升部分规划表现，但在复杂密集交通中可能伤害性能。这组发现对组内很重要，因为它直接提醒协同驾驶不能只用感知指标证明系统收益。

## 应用场景与启发

- 应用场景：闭环 V2X 协同驾驶评测、multi-agent policy benchmark、协同规划算法对比和 human-in-the-loop 场景测试。
- 方法启发：协同模块需要被放进闭环交通交互中评估，不能把 perception sharing 的改进自动等同于驾驶安全提升。
- 讨论问题：V2X benchmark 应该如何拆分信息共享、协商策略和下游 planner 的责任，才能解释“感知更准但规划没变好”的情况。

## 局限与阅读风险

MDrive 的结论依赖场景生成和仿真协议是否足够覆盖真实 V2X 长尾交互。摘要没有给出完整指标细节，正式采用前需要核对 benchmark 的交通参与者分布、通信假设、闭环 evaluator、失败定义和 baselines。若 negotiation 在密集交通中退化，也需要区分是协商策略本身问题，还是 planner 与仿真交互接口问题。

## 后续跟进

- 检查工具箱、场景生成脚本和 Real2Sim conversion 是否开放。
- 对照 SwarmDrive、Select2Drive 和 CoPAD，整理 V2X 从感知、语义通信到闭环规划的评测链。
- 重点记录哪些场景里 multi-agent 协同反而变差，作为后续鲁棒协同规划的切入点。
